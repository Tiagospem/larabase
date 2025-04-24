const Docker = require('dockerode');
const fs = require('fs');
const zlib = require('zlib');
const { Readable } = require('stream');

// Create dockerode instance with appropriate connection options
function createDockerClient() {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    // Check for Docker socket at standard location
    if (fs.existsSync('/var/run/docker.sock')) {
      return new Docker({ socketPath: '/var/run/docker.sock' });
    }
  } else if (platform === 'linux') {
    // Linux default socket
    if (fs.existsSync('/var/run/docker.sock')) {
      return new Docker({ socketPath: '/var/run/docker.sock' });
    }
  } else if (platform === 'win32') {
    // Windows uses named pipe
    return new Docker({ socketPath: '//./pipe/docker_engine' });
  }
  
  // Default to standard Docker connection options
  return new Docker();
}

// Check if Docker is available
async function isDockerAvailable() {
  try {
    const docker = createDockerClient();
    await docker.ping();
    return true;
  } catch (error) {
    console.error('Docker connection error:', error.message);
    return false;
  }
}

// Check if Docker Desktop is running on the host system
async function isDockerRunning() {
  try {
    return await isDockerAvailable();
  } catch (error) {
    return false;
  }
}

// Get list of Docker containers with port mapping details
async function getDockerContainers() {
  try {
    const docker = createDockerClient();
    const containers = await docker.listContainers({ all: false });
    
    return containers.map(container => {
      const name = container.Names[0].replace(/^\//, '');
      
      // Format port information similar to docker ps output
      let ports = '';
      if (container.Ports && container.Ports.length > 0) {
        ports = container.Ports.map(port => {
          if (port.PublicPort && port.PrivatePort) {
            return `${port.PublicPort}->${port.PrivatePort}/${port.Type}`;
          } else if (port.PrivatePort) {
            return `${port.PrivatePort}/${port.Type}`;
          }
          return '';
        }).join(', ');
      }
      
      return `${name} ${ports}`;
    });
  } catch (error) {
    console.error('Error listing Docker containers:', error.message);
    return [];
  }
}

// Detect MySQL containers running in Docker, especially for a given port
async function detectDockerMysql(port) {
  const result = {
    dockerAvailable: false,
    isDocker: false,
    dockerContainerName: null,
    message: ""
  };

  try {
    if (!await isDockerAvailable()) {
      result.message = "Docker CLI is not available";
      return result;
    }
    result.dockerAvailable = true;

    const docker = createDockerClient();
    const containers = await docker.listContainers();
    
    // Process containers
    for (const container of containers) {
      const name = container.Names[0].replace(/^\//, '');
      
      // Check for port match
      if (container.Ports && container.Ports.length > 0) {
        const portMatch = container.Ports.some(p => 
          p.PublicPort === parseInt(port) && p.PrivatePort === 3306);
        
        if (portMatch) {
          result.isDocker = true;
          result.dockerContainerName = name;
          result.message = `MySQL Docker container found: ${name}`;
          return result;
        }
      }
      
      // Check for MySQL-like container names
      if (/mysql|mariadb/i.test(name)) {
        result.isDocker = true;
        result.dockerContainerName = name;
        result.message = `MySQL-like container found: ${name} (not on port ${port})`;
        console.info(`Found MySQL-like container: ${name}`);
        return result;
      }
    }
    
    result.message = result.message || `No MySQL Docker container found on port ${port}`;
    return result;
  } catch (error) {
    console.error('Error detecting Docker MySQL:', error.message);
    result.message = `Error detecting Docker: ${error.message}`;
    return result;
  }
}

// Check if Redis is running in Docker
async function checkDockerRedis() {
  try {
    const docker = createDockerClient();
    const containers = await docker.listContainers();
    
    // Check for Redis containers
    return containers.some(container => {
      const name = container.Names[0].replace(/^\//, '');
      return name.toLowerCase().includes('redis');
    });
  } catch (error) {
    console.error('Error checking Docker Redis:', error.message);
    return false;
  }
}

// Execute MySQL command in Docker container
async function executeMysqlInContainer(containerName, credentials, database, sqlCommands) {
  try {
    const docker = createDockerClient();
    const container = docker.getContainer(containerName);
    
    // Build MySQL credentials string
    let mysqlFlags = ` -u${credentials.user || 'root'}`;
    if (credentials.password) mysqlFlags += ` -p${credentials.password}`;
    if (credentials.host && credentials.host !== 'localhost') mysqlFlags += ` -h${credentials.host}`;
    if (credentials.port) mysqlFlags += ` -P${credentials.port}`;
    
    // Create execution options
    const options = {
      Cmd: ['mysql', 
            '--binary-mode=1', 
            '--force',
            '--init-command', `CREATE DATABASE IF NOT EXISTS \`${database}\`; USE \`${database}\`;`,
            ...mysqlFlags.trim().split(' ').filter(f => f)
           ],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    };
    
    // Create exec instance
    const exec = await container.exec(options);
    const stream = await exec.start({hijack: true, stdin: true});
    
    // Send SQL commands to stdin
    if (sqlCommands) {
      stream.write(sqlCommands);
      stream.end();
    }
    
    // Return the stream for further processing if needed
    return stream;
  } catch (error) {
    console.error('Error executing MySQL in container:', error.message);
    throw error;
  }
}

// Process SQL file (handling gzip and filtering) and execute in Docker container
async function executeMysqlFileInContainer(containerName, credentials, database, sqlFilePath, ignoredTables = [], progressCallback) {
  try {
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    const isGzipped = sqlFilePath.toLowerCase().endsWith('.gz');
    const hasFilters = Array.isArray(ignoredTables) && ignoredTables.length > 0;
    
    // Get the container
    const docker = createDockerClient();
    const container = docker.getContainer(containerName);
    
    // Build MySQL command options
    let mysqlFlags = ` -u${credentials.user || 'root'}`;
    if (credentials.password) mysqlFlags += ` -p${credentials.password}`;
    if (credentials.host && credentials.host !== 'localhost') mysqlFlags += ` -h${credentials.host}`;
    if (credentials.port) mysqlFlags += ` -P${credentials.port}`;
    
    // Create execution options
    const options = {
      Cmd: ['mysql', 
            '--binary-mode=1', 
            '--force',
            '--init-command', `CREATE DATABASE IF NOT EXISTS \`${database}\`; USE \`${database}\`;`,
            ...mysqlFlags.trim().split(' ').filter(f => f)
           ],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    };
    
    // Create exec instance
    const exec = await container.exec(options);
    const execStream = await exec.start({hijack: true, stdin: true});
    
    let output = '';
    execStream.on('data', (chunk) => {
      output += chunk.toString();
    });
    
    // Progress tracking
    let totalSize = fs.statSync(sqlFilePath).size;
    let processedSize = 0;
    let lastProgress = 0;
    
    // Update progress function
    const updateProgress = (processed) => {
      processedSize = processed;
      const progress = Math.floor((processedSize / totalSize) * 100);
      
      if (progress > lastProgress && typeof progressCallback === 'function') {
        lastProgress = progress;
        progressCallback(progress);
      }
    };
    
    // Process the SQL file
    return new Promise((resolve, reject) => {
      try {
        // Create a readable stream from the file
        const fileStream = fs.createReadStream(sqlFilePath);
        let processStream;
        
        // Setup decompression if needed
        if (isGzipped) {
          const gunzip = zlib.createGunzip();
          processStream = fileStream.pipe(gunzip);
        } else {
          processStream = fileStream;
        }
        
        // Progress tracking
        fileStream.on('data', (chunk) => {
          updateProgress(processedSize + chunk.length);
        });
        
        // if we have tables to ignore, we need to filter the stream
        if (hasFilters) {
          let buffer = '';
          let inIgnoredTable = false;
          
          // Create regex patterns for ignored tables
          const ignoredTablePatterns = ignoredTables.map(table => 
            new RegExp(`(INSERT INTO|CREATE TABLE|DROP TABLE|ALTER TABLE)\\s+\`?${table}\`?`, 'i')
          );
          
          processStream.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // Process buffer line by line
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last (potentially incomplete) line in the buffer
            
            // Process complete lines
            for (const line of lines) {
              // Check if we should ignore this line/table
              if (!inIgnoredTable) {
                const shouldIgnore = ignoredTablePatterns.some(pattern => pattern.test(line));
                if (shouldIgnore) {
                  inIgnoredTable = true;
                  continue;
                }
              }
              
              // Check if we are exiting an ignored section
              if (inIgnoredTable && line.trim().endsWith(';')) {
                inIgnoredTable = false;
                continue;
              }
              
              // Write the line if it's not in an ignored section
              if (!inIgnoredTable) {
                execStream.write(line + '\n');
              }
            }
          });
          
          processStream.on('end', () => {
            // Process any remaining buffer
            if (buffer && !inIgnoredTable) {
              execStream.write(buffer);
            }
            execStream.end();
          });
        } else {
          // No filtering needed, pipe directly to the container
          processStream.pipe(execStream);
        }
        
        execStream.on('end', () => {
          resolve({ success: true, output });
        });
        
        execStream.on('error', (err) => {
          reject(err);
        });
        
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    console.error('Error executing MySQL file in container:', error.message);
    throw error;
  }
}

module.exports = {
  createDockerClient,
  isDockerAvailable,
  isDockerRunning,
  getDockerContainers,
  detectDockerMysql,
  checkDockerRedis,
  executeMysqlInContainer,
  executeMysqlFileInContainer
}; 