const { ipcMain } = require("electron");
const redis = require("redis");
const os = require("os");
const docker = require("./docker");

function createRedisClient(config, isRunningInDocker = false) {
  const options = {
    socket: {
      connectTimeout: 5000,
      timeout: 5000
    }
  };

  if (config.path) {
    options.socket.path = config.path;
  } else {
    options.socket.host = isRunningInDocker ? "localhost" : config.host || "localhost";
    options.socket.port = parseInt(config.port || 6379, 10);
  }

  if (config.password) {
    options.password = config.password;
  }

  return redis.createClient(options);
}

async function checkDockerRedis() {
  return await docker.checkDockerRedis();
}

async function checkRedisStatus(event, config) {
  let client = null;

  try {
    const isRunningInDocker = await checkDockerRedis();
    const runningMode = isRunningInDocker ? "Docker" : "Local";

    client = createRedisClient(config, isRunningInDocker);

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

async function getRedisDatabases(event, config) {
  let client = null;

  try {
    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    const info = await client.sendCommand(["INFO", "keyspace"]);
    const memory = await client.sendCommand(["INFO", "memory"]);

    const usedMemory = parseRedisInfo(memory)["used_memory"] || 0;

    const keyspaceInfo = parseRedisInfo(info);
    const databases = [];

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

async function clearAllRedisDatabases(event, config) {
  let client = null;

  try {
    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

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

function parseDbInfo(infoString) {
  const result = {};
  const parts = infoString.split(",");

  for (const part of parts) {
    const [key, value] = part.split("=");
    result[key] = parseInt(value, 10);
  }

  return result;
}

function calculateDbMemory(dbKeys, totalMemory, totalKeys) {
  if (totalKeys === 0 || dbKeys === 0) return 0;

  return Math.floor((dbKeys / totalKeys) * totalMemory);
}

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

async function getRedisKeys(event, config) {
  let client = null;

  try {
    if (!config.dbIndex && config.dbIndex !== 0) {
      return {
        success: false,
        message: "Database index is required"
      };
    }

    const dbIndex = parseInt(config.dbIndex.replace("db", ""), 10);

    if (isNaN(dbIndex) || dbIndex < 0 || dbIndex > 15) {
      return {
        success: false,
        message: "Invalid database index. Must be between 0 and 15."
      };
    }

    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    await client.sendCommand(["SELECT", dbIndex.toString()]);

    const pattern = config.pattern || "*";
    const limit = config.limit || 100;
    const offset = config.offset || 0;

    let keys = [];
    let cursor = "0";
    let count = 0;

    do {
      const result = await client.sendCommand(["SCAN", cursor, "MATCH", pattern, "COUNT", "50"]);
      cursor = result[0];
      const batchKeys = result[1];

      for (const key of batchKeys) {
        if (count >= offset && keys.length < limit) {
          keys.push(key);
        }
        count++;
      }
    } while (cursor !== "0" && keys.length < limit);

    await client.quit();

    return {
      success: true,
      keys,
      hasMore: keys.length >= limit
    };
  } catch (err) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Failed to get Redis keys: ${err.message}`
    };
  }
}

async function getRedisKeyValue(event, config) {
  let client = null;

  try {
    if (!config.dbIndex && config.dbIndex !== 0) {
      return {
        success: false,
        message: "Database index is required"
      };
    }

    if (!config.key) {
      return {
        success: false,
        message: "Key is required"
      };
    }

    const dbIndex = parseInt(config.dbIndex.replace("db", ""), 10);

    if (isNaN(dbIndex) || dbIndex < 0 || dbIndex > 15) {
      return {
        success: false,
        message: "Invalid database index. Must be between 0 and 15."
      };
    }

    const statusCheck = await checkRedisStatus(event, config);
    if (!statusCheck.success) {
      return statusCheck;
    }

    client = createRedisClient(config, statusCheck.runningMode === "Docker");
    await client.connect();

    await client.sendCommand(["SELECT", dbIndex.toString()]);

    const keyType = await client.sendCommand(["TYPE", config.key]);
    let value;
    let ttl = await client.sendCommand(["TTL", config.key]);

    switch (keyType.toLowerCase()) {
      case "string":
        value = await client.sendCommand(["GET", config.key]);
        break;
      case "list":
        value = await client.sendCommand(["LRANGE", config.key, "0", "99"]);
        break;
      case "set":
        value = await client.sendCommand(["SMEMBERS", config.key]);
        break;
      case "zset":
        value = await client.sendCommand(["ZRANGE", config.key, "0", "99", "WITHSCORES"]);

        if (Array.isArray(value)) {
          const result = [];
          for (let i = 0; i < value.length; i += 2) {
            result.push({
              value: value[i],
              score: value[i + 1]
            });
          }
          value = result;
        }
        break;
      case "hash":
        value = await client.sendCommand(["HGETALL", config.key]);

        if (Array.isArray(value)) {
          const result = {};
          for (let i = 0; i < value.length; i += 2) {
            result[value[i]] = value[i + 1];
          }
          value = result;
        }
        break;
      default:
        value = `Unsupported type: ${keyType}`;
    }

    await client.quit();

    return {
      success: true,
      key: config.key,
      type: keyType.toLowerCase(),
      value,
      ttl: ttl === -1 ? null : ttl
    };
  } catch (err) {
    if (client && client.isOpen) {
      await client.quit().catch(() => {});
    }

    return {
      success: false,
      message: `Failed to get Redis key value: ${err.message}`
    };
  }
}

function registerRedisHandlers() {
  ipcMain.handle("check-redis-status", checkRedisStatus);
  ipcMain.handle("get-redis-databases", getRedisDatabases);
  ipcMain.handle("clear-redis-database", clearRedisDatabase);
  ipcMain.handle("clear-all-redis-databases", clearAllRedisDatabases);
  ipcMain.handle("get-redis-keys", getRedisKeys);
  ipcMain.handle("get-redis-key-value", getRedisKeyValue);
}

module.exports = {
  registerRedisHandlers
};
