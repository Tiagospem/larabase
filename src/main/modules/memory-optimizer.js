const { getMainWindow } = require("./window");

const MEMORY_CONFIG = {
  checkIntervalMs: 60000,
  warningThreshold: 300,
  criticalThreshold: 500,
  gcIntervalMs: 300000,
  maxDatabaseOperations: 500
};

let memoryCheckInterval = null;
let gcInterval = null;

function initializeMemoryOptimizer() {
  if (process.env.NODE_ENV === "development") {
    console.log("[Memory Optimizer] Running in development mode - some optimizations disabled");
  }

  memoryCheckInterval = setInterval(checkMemoryUsage, MEMORY_CONFIG.checkIntervalMs);

  gcInterval = setInterval(attemptGarbageCollection, MEMORY_CONFIG.gcIntervalMs);

  setTimeout(() => {
    checkMemoryUsage();
    attemptGarbageCollection();
  }, 30000);
}

function checkMemoryUsage() {
  try {
    const memoryInfo = process.getProcessMemoryInfo ? process.getProcessMemoryInfo() : { private: process.memoryUsage().heapUsed / 1024 / 1024 };

    const memoryUsageMB = Math.round(memoryInfo.private);

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

  attemptGarbageCollection();

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

  attemptGarbageCollection(true);

  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send("memory-critical", {
      usage: usageMB,
      threshold: MEMORY_CONFIG.criticalThreshold,
      message: `Application is using ${usageMB}MB of memory. Performance may be affected.`
    });
  }
}

function attemptGarbageCollection(aggressive = false) {
  try {
    if (global.gc) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Memory] Running garbage collection" + (aggressive ? " (aggressive)" : ""));
      }

      if (aggressive) {
        global.gc();
        setTimeout(() => global.gc(), 500);
        setTimeout(() => global.gc(), 1500);
      } else {
        global.gc();
      }
    }
  } catch (error) {
    console.error("[Memory Optimizer] Error during garbage collection:", error);
  }
}

function cleanupMemoryOptimizer() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
  }

  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
  }

  attemptGarbageCollection(true);
}

module.exports = {
  initializeMemoryOptimizer,
  attemptGarbageCollection,
  cleanupMemoryOptimizer,
  MEMORY_CONFIG
};
