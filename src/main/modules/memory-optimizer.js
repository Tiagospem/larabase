const { getMainWindow } = require("./window");

const MEMORY_CONFIG = {
  checkIntervalMs: 60000,
  warningThreshold: 300,
  criticalThreshold: 500,
  maxDatabaseOperations: 500
};

let memoryCheckInterval = null;

function initializeMemoryOptimizer() {
  if (process.env.NODE_ENV === "development") {
    console.log("[Memory Optimizer] Running in development mode - some optimizations disabled");
  }

  memoryCheckInterval = setInterval(checkMemoryUsage, MEMORY_CONFIG.checkIntervalMs);

  setTimeout(() => {
    checkMemoryUsage();
  }, 30000);
}

function checkMemoryUsage() {
  try {
    const memoryInfo = typeof process.getProcessMemoryInfo === "function" ? process.getProcessMemoryInfo() : { private: process.memoryUsage().heapUsed / 1024 / 1024 };

    let memoryValue;
    try {
      memoryValue = typeof memoryInfo.private === "number" && !isNaN(memoryInfo.private) ? memoryInfo.private : process.memoryUsage().heapUsed / 1024 / 1024;
    } catch (e) {
      memoryValue = 0;
      console.error("[Memory] Error getting memory usage details:", e);
    }

    const memoryUsageMB = Math.round(memoryValue);

    if (process.env.NODE_ENV === "development") {
      console.log(`[Memory] Current usage: ${memoryUsageMB}MB`);
    }

    if (memoryUsageMB > MEMORY_CONFIG.criticalThreshold) {
      handleCriticalMemoryUsage(memoryUsageMB);
    } else if (memoryUsageMB > MEMORY_CONFIG.warningThreshold) {
      handleHighMemoryUsage(memoryUsageMB);
    }
  } catch (error) {
    console.error("[Memory Optimizer] Error checking memory usage:", error);
  }
}

function handleHighMemoryUsage(usageMB) {
  console.warn(`[Memory] High memory usage detected: ${usageMB}MB`);

  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send("memory-warning", {
      usage: usageMB,
      threshold: MEMORY_CONFIG.warningThreshold,
      message: `Application is using ${usageMB}MB of memory. Consider closing unused tabs.`
    });
  }
}

function handleCriticalMemoryUsage(usageMB) {
  console.error(`[Memory] Critical memory usage detected: ${usageMB}MB`);

  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send("memory-critical", {
      usage: usageMB,
      threshold: MEMORY_CONFIG.criticalThreshold,
      message: `Application is using ${usageMB}MB of memory. Performance may be affected.`
    });
  }
}

function cleanupMemoryOptimizer() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
  }
}

module.exports = {
  initializeMemoryOptimizer,
  cleanupMemoryOptimizer,
  MEMORY_CONFIG
};
