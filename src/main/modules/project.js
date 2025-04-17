const { ipcMain, dialog } = require('electron');
const { getMainWindow } = require('../modules/window');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOCKER_SOCKET = '/var/run/docker.sock';

function socketExists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

function execCommand(cmd, { timeout = 2000, windowsHide = true, stdio = 'pipe' } = {}) {
  try {
    return execSync(cmd, { timeout, shell: true, windowsHide, stdio }).toString();
  } catch {
    return '';
  }
}

function checkDockerByOS() {
  const platform = process.platform;

  if (platform === 'darwin') {
    if (!socketExists(DOCKER_SOCKET)) return false;
    return Boolean(execCommand('ps aux | grep -v grep | grep -E "Docker(Desktop|.app)"'));
  }

  if (platform === 'linux') {
    if (socketExists(DOCKER_SOCKET)) return true;

    execCommand('systemctl is-active --quiet docker');
    return true;
  }

  if (platform === 'win32') {
    const hasDesktop = execCommand('tasklist /FI "IMAGENAME eq Docker Desktop.exe" /NH');
    if (hasDesktop.includes('Docker Desktop.exe')) return true;
    return execCommand('sc query docker').includes('RUNNING');
  }

  return false;
}

function isDockerCliAvailable() {
  if (execCommand('docker --version', { timeout: 3000 })) {
    return true;
  }

  if (checkDockerByOS()) {
    return true;
  }

  if (process.platform !== 'win32' && socketExists(DOCKER_SOCKET)) {
    return true;
  }

  return (
    process.platform === 'win32' &&
    socketExists('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe')
  );
}

function getDockerContainers() {
  const output = execCommand('docker ps --format "{{.Names}} {{.Ports}}"', { timeout: 5000 });
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function detectDockerMysql(port) {
  const result = {
    dockerAvailable: false,
    isDocker: false,
    dockerContainerName: null,
    message: ''
  };

  if (!isDockerCliAvailable()) {
    result.message = 'Docker CLI is not available';
    return result;
  }
  result.dockerAvailable = true;

  let containers = [];

  try {
    containers = getDockerContainers();
    console.info('Active Docker containers:', containers);
  } catch (err) {
    console.error('Error listing Docker containers:', err.message);
    result.message = 'Docker detected but container listing failed. Check permissions.';
  }

  const portRegex = new RegExp(`(?:^|\\s)(\\S+).*?\\b${port}:?->?3306\\b`);

  for (const line of containers) {
    const m = portRegex.exec(line);
    if (m) {
      result.isDocker = true;
      result.dockerContainerName = m[1];
      result.message = `MySQL Docker container found: ${m[1]}`;
      return result;
    }
  }

  for (const line of containers) {
    if (/mysql|mariadb/i.test(line)) {
      const name = line.split(' ')[0];
      result.isDocker = true;
      result.dockerContainerName = name;
      result.message = `MySQL-like container found: ${name} (not on port ${port})`;
      console.info(`Found MySQL-like container: ${name}`);
      return result;
    }
  }

  if (process.platform !== 'win32') {
    const ps = execCommand('ps aux | grep -v grep | grep -E "mysql|mariadb"');
    if (ps) {
      result.isDocker = true;
      result.dockerContainerName = 'mysql-container';
      result.message = 'MySQL process detected, assuming Docker container';
      return result;
    }
  }

  result.message = result.message || `No MySQL Docker container found on port ${port}`;
  return result;
}

function selectDirectoryHandler() {
  ipcMain.handle('select-directory', async () => {
    const mainWindow = getMainWindow();

    try {
      return await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      });
    } catch (error) {
      console.error('Error selecting directory:', error);
      throw error;
    }
  });
}

function validateLaravelProjectHandler() {
  ipcMain.handle('validate-laravel-project', async (event, projectPath) => {
    try {
      const hasEnv = fs.existsSync(path.join(projectPath, '.env'));
      const hasArtisan = fs.existsSync(path.join(projectPath, 'artisan'));
      const hasComposerJson = fs.existsSync(path.join(projectPath, 'composer.json'));

      return hasEnv && hasArtisan && hasComposerJson;
    } catch (error) {
      console.error('Error validating Laravel project:', error);
      return false;
    }
  });
}

function readEnvFileHandler() {
  ipcMain.handle('read-env-file', async (event, projectPath) => {
    try {
      const envPath = path.join(projectPath, '.env');

      if (!fs.existsSync(envPath)) {
        console.error('.env file not found at:', envPath);
        return null;
      }

      const envContent = fs.readFileSync(envPath, 'utf8');
      const envConfig = {};

      envContent.split('\n').forEach(line => {
        if (line.startsWith('#') || line.trim() === '') {
          return;
        }

        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';

          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }

          envConfig[key] = value;
        }
      });

      if (envConfig.DB_PORT) {
        envConfig.dockerInfo = detectDockerMysql(envConfig.DB_PORT);
      }

      return envConfig;
    } catch (error) {
      console.error('Error reading .env file:', error);
      return null;
    }
  });
}

function registerProjectHandlers() {
  selectDirectoryHandler();
  validateLaravelProjectHandler();
  readEnvFileHandler();
}

module.exports = { registerProjectHandlers, isDockerCliAvailable };
