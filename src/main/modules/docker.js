const Docker = require("dockerode");
const fs = require("fs");
const zlib = require("zlib");

function createDockerClient() {
  const platform = process.platform;

  if (platform === "darwin") {
    if (fs.existsSync("/var/run/docker.sock")) {
      return new Docker({ socketPath: "/var/run/docker.sock" });
    }
  } else if (platform === "linux") {
    if (fs.existsSync("/var/run/docker.sock")) {
      return new Docker({ socketPath: "/var/run/docker.sock" });
    }
  } else if (platform === "win32") {
    return new Docker({ socketPath: "//./pipe/docker_engine" });
  }

  return new Docker();
}

async function isDockerAvailable() {
  try {
    const docker = createDockerClient();
    await docker.ping();
    return true;
  } catch (error) {
    console.error("Docker connection error:", error.message);
    return false;
  }
}

async function isDockerRunning() {
  try {
    return await isDockerAvailable();
  } catch (error) {
    return false;
  }
}

async function getDockerContainers() {
  try {
    const docker = createDockerClient();
    const containers = await docker.listContainers({ all: false });

    return containers.map((container) => {
      const name = container.Names[0].replace(/^\//, "");

      let ports = "";
      if (container.Ports && container.Ports.length > 0) {
        ports = container.Ports.map((port) => {
          if (port.PublicPort && port.PrivatePort) {
            return `${port.PublicPort}->${port.PrivatePort}/${port.Type}`;
          } else if (port.PrivatePort) {
            return `${port.PrivatePort}/${port.Type}`;
          }
          return "";
        }).join(", ");
      }

      return `${name} ${ports}`;
    });
  } catch (error) {
    console.error("Error listing Docker containers:", error.message);
    return [];
  }
}

async function detectDockerMysql(port) {
  const result = {
    dockerAvailable: false,
    isDocker: false,
    dockerContainerName: null,
    message: ""
  };

  try {
    if (!(await isDockerAvailable())) {
      result.message = "Docker CLI is not available";
      return result;
    }
    result.dockerAvailable = true;

    const docker = createDockerClient();
    const containers = await docker.listContainers();

    for (const container of containers) {
      const name = container.Names[0].replace(/^\//, "");

      if (container.Ports && container.Ports.length > 0) {
        const portMatch = container.Ports.some((p) => p.PublicPort === parseInt(port) && p.PrivatePort === 3306);

        if (portMatch) {
          result.isDocker = true;
          result.dockerContainerName = name;
          result.message = `MySQL Docker container found: ${name}`;
          return result;
        }
      }

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
    console.error("Error detecting Docker MySQL:", error.message);
    result.message = `Error detecting Docker: ${error.message}`;
    return result;
  }
}

async function checkDockerRedis() {
  try {
    const docker = createDockerClient();
    const containers = await docker.listContainers();

    return containers.some((container) => {
      const name = container.Names[0].replace(/^\//, "");
      return name.toLowerCase().includes("redis");
    });
  } catch (error) {
    console.error("Error checking Docker Redis:", error.message);
    return false;
  }
}

async function executeMysqlInContainer(containerName, credentials, database, sqlCommands) {
  try {
    const docker = createDockerClient();
    const container = docker.getContainer(containerName);

    let mysqlFlags = ` -u${credentials.user || "root"}`;
    if (credentials.password) mysqlFlags += ` -p${credentials.password}`;
    if (credentials.host && credentials.host !== "localhost") mysqlFlags += ` -h${credentials.host}`;
    if (credentials.port) mysqlFlags += ` -P${credentials.port}`;

    const options = {
      Cmd: [
        "mysql",
        "--binary-mode=1",
        "--force",
        "--init-command",
        `CREATE DATABASE IF NOT EXISTS \`${database}\`; USE \`${database}\`;`,
        ...mysqlFlags
          .trim()
          .split(" ")
          .filter((f) => f)
      ],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    };

    const exec = await container.exec(options);
    const stream = await exec.start({ hijack: true, stdin: true });

    stream.dockerExecId = exec.id;
    stream.dockerContainer = containerName;

    if (sqlCommands) {
      stream.write(sqlCommands);
      stream.end();
    }

    return stream;
  } catch (error) {
    console.error("Error executing MySQL in container:", error.message);
    throw error;
  }
}

async function executeMysqlFileInContainer(containerName, credentials, database, sqlFilePath, ignoredTables = [], progressCallback, overwriteCurrentDb = false, ignoreCreateDatabase = false) {
  let isCancelled = false;

  const safeProgressCallback = (progress) => {
    if (isCancelled || global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
      return;
    }

    if (typeof progressCallback === "function") {
      progressCallback(progress);
    }
  };

  const cancellationCheck = setInterval(() => {
    if (global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
      console.log("Docker module detected cancellation request");
      isCancelled = true;
      clearInterval(cancellationCheck);
    }
  }, 300);

  try {
    if (!fs.existsSync(sqlFilePath)) {
      clearInterval(cancellationCheck);
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    const isGzipped = sqlFilePath.toLowerCase().endsWith(".gz");
    const hasFilters = Array.isArray(ignoredTables) && ignoredTables.length > 0;

    const docker = createDockerClient();
    const container = docker.getContainer(containerName);

    let mysqlFlags = ` -u${credentials.user || "root"}`;
    if (credentials.password) mysqlFlags += ` -p${credentials.password}`;
    if (credentials.host && credentials.host !== "localhost") mysqlFlags += ` -h${credentials.host}`;
    if (credentials.port) mysqlFlags += ` -P${credentials.port}`;

    const options = {
      Cmd: [
        "mysql",
        "--binary-mode=1",
        "--force",
        "--init-command",
        overwriteCurrentDb ? `DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\`; USE \`${database}\`;` : `CREATE DATABASE IF NOT EXISTS \`${database}\`; USE \`${database}\`;`,
        ...mysqlFlags
          .trim()
          .split(" ")
          .filter((f) => f)
      ],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    };

    const exec = await container.exec(options);
    const execStream = await exec.start({ hijack: true, stdin: true });

    execStream.write(`USE \`${database}\`;\n`);

    execStream.dockerExecId = exec.id;
    execStream.dockerContainer = containerName;

    let output = "";
    execStream.on("data", (chunk) => {
      if (isCancelled) return;
      output += chunk.toString();
    });

    let totalSize = fs.statSync(sqlFilePath).size;
    let processedSize = 0;
    let lastProgress = 0;

    const updateProgress = (processed) => {
      if (isCancelled) return;

      processedSize = processed;
      const progress = Math.floor((processedSize / totalSize) * 100);

      if (progress > lastProgress) {
        lastProgress = progress;
        safeProgressCallback(progress);
      }
    };

    return new Promise((resolve, reject) => {
      try {
        const streamCancellationCheck = setInterval(() => {
          if (isCancelled || global.cancelRestoreRequested || !global.ongoingRestoreOperation) {
            clearInterval(streamCancellationCheck);

            try {
              if (fileStream && !fileStream.destroyed) {
                fileStream.destroy();
              }

              if (processStream && processStream !== fileStream && !processStream.destroyed) {
                processStream.destroy();
              }

              if (execStream && !execStream.destroyed) {
                execStream.destroy();
              }

              container
                .exec({
                  Cmd: ["pkill", "-9", "mysql"],
                  AttachStdout: true,
                  AttachStderr: true
                })
                .then((killExec) => {
                  killExec.start();
                })
                .catch((err) => console.error("Failed to send emergency kill:", err));
            } catch (err) {
              console.error("Error destroying streams:", err);
            }

            reject(new Error("Operation cancelled"));
          }
        }, 300);

        const fileStream = fs.createReadStream(sqlFilePath, {
          highWaterMark: 64 * 1024 // Reduzindo o tamanho do buffer
        });
        let processStream;

        fileStream.on("error", (err) => {
          clearInterval(streamCancellationCheck);
          reject(err);
        });

        if (isGzipped) {
          const gunzip = zlib.createGunzip();
          gunzip.on("error", (err) => {
            clearInterval(streamCancellationCheck);
            reject(err);
          });

          processStream = fileStream.pipe(gunzip);
        } else {
          processStream = fileStream;
        }

        fileStream.on("data", (chunk) => {
          if (isCancelled) return;
          updateProgress(processedSize + chunk.length);
        });

        if (hasFilters || ignoreCreateDatabase) {
          let buffer = "";
          let inIgnoredInsert = false;
          let batchSize = 0;
          const maxBatchSize = 512 * 1024; // 512KB por lote

          const ignoredTablePatterns = ignoredTables.map((table) => new RegExp(`INSERT\\s+INTO\\s+\`?${table}\`?`, "i"));
          const createDatabasePattern = new RegExp(`CREATE\\s+DATABASE|USE\\s+\``, "i");

          const processBatch = () => {
            if (buffer.length > 0) {
              let lines = buffer.split("\n");
              buffer = lines.pop() || "";

              let batch = "";
              let shouldWrite = false;

              for (const line of lines) {
                if (isCancelled) break;

                if (!inIgnoredInsert) {
                  const shouldIgnoreTable = ignoredTablePatterns.some((pattern) => pattern.test(line));
                  const shouldIgnoreDbCommand = createDatabasePattern && createDatabasePattern.test(line);

                  if (shouldIgnoreTable) {
                    inIgnoredInsert = true;
                    continue;
                  }

                  if (shouldIgnoreDbCommand) {
                    continue;
                  }
                }

                if (inIgnoredInsert && line.trim().endsWith(";")) {
                  inIgnoredInsert = false;
                  continue;
                }

                if (!inIgnoredInsert) {
                  batch += line + "\n";
                  shouldWrite = true;
                }
              }

              if (shouldWrite && batch.length > 0) {
                try {
                  const canContinue = execStream.write(batch);
                  if (!canContinue) {
                    processStream.pause();
                    execStream.once("drain", () => {
                      processStream.resume();
                    });
                  }
                } catch (err) {
                  console.error("Error writing to stream:", err);
                }
              }

              batchSize = buffer.length;
            }
          };

          processStream.on("data", (chunk) => {
            if (isCancelled) return;

            buffer += chunk.toString();
            batchSize += chunk.length;

            if (batchSize >= maxBatchSize) {
              processBatch();
            }
          });

          processStream.on("end", () => {
            if (isCancelled) return;

            processBatch();

            if (buffer.length > 0 && !inIgnoredInsert) {
              try {
                execStream.write(buffer);
              } catch (err) {
                console.error("Error writing final buffer:", err);
              }
            }

            try {
              execStream.end();
            } catch (err) {
              console.error("Error ending stream:", err);
            }
          });
        } else {
          processStream.pipe(execStream);
        }

        execStream.on("end", () => {
          clearInterval(streamCancellationCheck);
          if (!isCancelled) {
            resolve(execStream);
          }
        });

        execStream.on("error", (err) => {
          clearInterval(streamCancellationCheck);
          reject(err);
        });

        execStream.on("close", () => {
          clearInterval(streamCancellationCheck);
          if (!isCancelled) {
            resolve(execStream);
          }
        });
      } catch (err) {
        clearInterval(cancellationCheck);
        reject(err);
      }
    }).finally(() => {
      clearInterval(cancellationCheck);
    });
  } catch (error) {
    clearInterval(cancellationCheck);
    console.error("Error executing MySQL file in container:", error.message);
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
