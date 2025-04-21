const { ipcMain } = require("electron");
const { execSync } = require("child_process");
const redis = require("redis");
const os = require("os");

/**
 * Create Redis client with consistent options
 */
function createRedisClient(config, isRunningInDocker = false) {
  // Basic options with timeouts
  const options = {
    socket: {
      connectTimeout: 5000,
      timeout: 5000
    }
  };

  if (config.path) {
    // Unix socket connection
    options.socket.path = config.path;
  } else {
    // TCP connection
    options.socket.host = isRunningInDocker ? "localhost" : config.host || "localhost";
    options.socket.port = parseInt(config.port || 6379, 10);
  }

  // Add password if provided
  if (config.password) {
    options.password = config.password;
  }

  return redis.createClient(options);
}

/**
 * Check if Redis is running in Docker
 */
function checkDockerRedis() {
  try {
    const platform = os.platform();
    const dockerCommand = platform === "win32" ? 'docker ps --filter "name=redis" --format "{{.Names}}"' : 'docker ps --filter "name=redis" --format "{{.Names}}"';

    const output = execSync(dockerCommand, { encoding: "utf8" });
    return output && output.toLowerCase().includes("redis");
  } catch (err) {
    return false;
  }
}

/**
 * Check if Redis is running and determine if it's running locally or in Docker
 */
async function checkRedisStatus(event, config) {
  let client = null;

  try {
    const isRunningInDocker = checkDockerRedis();
    const runningMode = isRunningInDocker ? "Docker" : "Local";

    // Create client
    client = createRedisClient(config, isRunningInDocker);

    // Try to connect with a timeout
    try {
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 5000));

      await Promise.race([connectPromise, timeoutPromise]);
      await client.quit();

      return {
        success: true,
        runningMode
      };
    } catch (connectionErr) {
      if (client.isOpen) {
        await client.quit().catch(() => {});
      }

      return {
        success: false,
        message: `Could not connect to Redis: ${connectionErr.message}`,
        runningMode: "Not Running"
      };
    }
  } catch (error) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Error checking Redis status: ${error.message}`
    };
  }
}

/**
 * Get information about Redis databases
 */
async function getRedisDatabases(event, config) {
  let client = null;

  try {
    // First check if Redis is running
    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    // Create client
    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    // Get list of databases with key counts and memory usage
    const info = await client.sendCommand(["INFO", "keyspace"]);
    const memory = await client.sendCommand(["INFO", "memory"]);

    // Parse memory usage
    const usedMemory = parseRedisInfo(memory)["used_memory"] || 0;

    // Parse database info
    const keyspaceInfo = parseRedisInfo(info);
    const databases = [];

    // Redis typically has 16 databases (0-15) by default
    for (let i = 0; i < 16; i++) {
      const dbKey = `db${i}`;
      if (keyspaceInfo[dbKey]) {
        const dbInfo = parseDbInfo(keyspaceInfo[dbKey]);
        databases.push({
          id: `db${i}`,
          name: `Database ${i}`,
          keys: dbInfo.keys || 0,
          expires: dbInfo.expires || 0,
          avgTtl: dbInfo.avg_ttl || 0,
          memory: calculateDbMemory(dbInfo.keys, usedMemory, getTotalKeys(keyspaceInfo))
        });
      } else {
        // Database exists but is empty
        databases.push({
          id: `db${i}`,
          name: `Database ${i}`,
          keys: 0,
          expires: 0,
          avgTtl: 0,
          memory: 0
        });
      }
    }

    await client.quit();

    return {
      success: true,
      databases
    };
  } catch (err) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Failed to get Redis databases: ${err.message}`
    };
  }
}

/**
 * Clear a specific Redis database
 */
async function clearRedisDatabase(event, config) {
  let client = null;

  try {
    if (!config.dbIndex) {
      return {
        success: false,
        message: "Database index is required"
      };
    }

    // Extract the numeric index from dbIndex (e.g., 'db0' -> 0)
    const dbIndex = parseInt(config.dbIndex.replace("db", ""), 10);
    if (isNaN(dbIndex) || dbIndex < 0 || dbIndex > 15) {
      return {
        success: false,
        message: "Invalid database index. Must be between 0 and 15."
      };
    }

    // First check if Redis is running
    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    // Create client
    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    // Select the database
    await client.sendCommand(["SELECT", dbIndex.toString()]);

    // Clear the database
    await client.sendCommand(["FLUSHDB"]);
    await client.quit();

    return {
      success: true,
      message: `Database ${dbIndex} cleared successfully`
    };
  } catch (err) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Failed to clear database: ${err.message}`
    };
  }
}

/**
 * Clear all Redis databases
 */
async function clearAllRedisDatabases(event, config) {
  let client = null;

  try {
    // First check if Redis is running
    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    // Create client
    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    // Clear all databases
    await client.sendCommand(["FLUSHALL"]);
    await client.quit();

    return {
      success: true,
      message: "All Redis databases cleared successfully"
    };
  } catch (err) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Failed to clear all databases: ${err.message}`
    };
  }
}

/**
 * Parse the Redis INFO command output
 */
function parseRedisInfo(info) {
  const result = {};
  const lines = info.split("\r\n");

  for (const line of lines) {
    if (line && !line.startsWith("#")) {
      const parts = line.split(":");
      if (parts.length === 2) {
        result[parts[0]] = parts[1];
      }
    }
  }

  return result;
}

/**
 * Parse database info string (e.g., "keys=1,expires=0,avg_ttl=0")
 */
function parseDbInfo(infoString) {
  const result = {};
  const parts = infoString.split(",");

  for (const part of parts) {
    const [key, value] = part.split("=");
    result[key] = parseInt(value, 10);
  }

  return result;
}

/**
 * Calculate the approximate memory usage for a database
 */
function calculateDbMemory(dbKeys, totalMemory, totalKeys) {
  if (totalKeys === 0 || dbKeys === 0) return 0;

  // Approximate memory usage based on key count ratio
  return Math.floor((dbKeys / totalKeys) * totalMemory);
}

/**
 * Get total keys across all databases
 */
function getTotalKeys(keyspaceInfo) {
  let total = 0;

  for (const key in keyspaceInfo) {
    if (key.startsWith("db")) {
      const dbInfo = parseDbInfo(keyspaceInfo[key]);
      total += dbInfo.keys || 0;
    }
  }

  return total || 1; // Avoid division by zero
}

function registerRedisHandlers() {
  ipcMain.handle("check-redis-status", checkRedisStatus);
  ipcMain.handle("get-redis-databases", getRedisDatabases);
  ipcMain.handle("clear-redis-database", clearRedisDatabase);
  ipcMain.handle("clear-all-redis-databases", clearAllRedisDatabases);
}

module.exports = {
  registerRedisHandlers
};
