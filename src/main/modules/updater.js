const { app, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Enable updates in development mode
autoUpdater.allowPrerelease = true;
autoUpdater.forceDevUpdateConfig = true;

let updateState = {
  updateAvailable: false,
  updateDownloaded: false,
  dialogOpen: false,
  notifiedVersion: null
};

let mainWindow;
const updateCheckIntervalMs = 3600000; // 1 hour
let updateCheckInterval;

function registerUpdaterHandlers(window) {
  mainWindow = window;
  
  // Log the current app version and update configuration
  log.info(`App version: ${app.getVersion()}`);
  log.info(`Update config - allowPrerelease: ${autoUpdater.allowPrerelease}, forceDevUpdateConfig: ${autoUpdater.forceDevUpdateConfig}`);
  log.info(`GitHub repository: ${process.env.npm_package_build_publish_repo || 'unknown'}`);
  
  // Log the autoUpdater configuration
  try {
    const updateConfig = autoUpdater.configOnDisk || {};
    log.info('Update configuration:', JSON.stringify({
      provider: updateConfig.provider,
      repo: updateConfig.repo,
      owner: updateConfig.owner,
      url: updateConfig.url
    }));
  } catch (error) {
    log.error('Failed to log update configuration:', error);
  }

  // Setup update events handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    sendStatusToWindow('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    
    // Verificar se já notificamos sobre esta versão
    if (updateState.notifiedVersion === info.version) {
      log.info(`Already notified about version ${info.version}, skipping notification`);
      return;
    }
    
    updateState.updateAvailable = true;
    updateState.notifiedVersion = info.version;
    
    sendStatusToWindow('update-available', info);
    
    // Evitar mostrar o diálogo se outro já estiver aberto
    if (!updateState.dialogOpen && !updateState.updateDownloaded && mainWindow) {
      updateState.dialogOpen = true;
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available.`,
        detail: 'Would you like to download it now? The update will be installed when you restart the application.',
        buttons: ['Download', 'Later'],
        defaultId: 0
      }).then(({ response }) => {
        updateState.dialogOpen = false;
        if (response === 0) {
          log.info(`User initiated download of version ${info.version}`);
          autoUpdater.downloadUpdate();
        }
      }).catch(err => {
        updateState.dialogOpen = false;
        log.error('Error showing update dialog:', err);
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available:', info);
    updateState.updateAvailable = false;
    sendStatusToWindow('update-not-available');
  });

  autoUpdater.on('error', (err) => {
    log.error('Error during update:', err);
    updateState.dialogOpen = false;
    sendStatusToWindow('update-error', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    log.info(logMessage);
    sendStatusToWindow('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    updateState.updateDownloaded = true;
    sendStatusToWindow('update-downloaded', info);
    
    if (!updateState.dialogOpen && mainWindow) {
      updateState.dialogOpen = true;
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded.',
        detail: 'Would you like to restart the application and install the update now?',
        buttons: ['Restart', 'Later'],
        defaultId: 0
      }).then(({ response }) => {
        updateState.dialogOpen = false;
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      }).catch(err => {
        updateState.dialogOpen = false;
        log.error('Error showing update-ready dialog:', err);
      });
    }
  });

  // IPC handlers for renderer process to interact with updater
  ipcMain.handle('check-for-updates', async () => {
    try {
      log.info('Manual update check requested');
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Error checking for updates:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('download-update', async () => {
    try {
      log.info('Manual download requested');
      if (!updateState.updateDownloaded) {
        return await autoUpdater.downloadUpdate();
      } else {
        log.info('Update already downloaded, skipping download');
        return { alreadyDownloaded: true };
      }
    } catch (error) {
      log.error('Error downloading update:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('quit-and-install', () => {
    log.info('Manual quit and install requested');
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-current-version', () => {
    return app.getVersion();
  });
  
  // Schedule periodic update checks
  setupAutoUpdateCheck();
}

function sendStatusToWindow(status, data = null) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

function setupAutoUpdateCheck() {
  // Check for updates after a delay to ensure app is fully initialized
  setTimeout(() => {
    log.info('Performing initial update check...');
    autoUpdater.checkForUpdates()
      .catch(err => log.error('Initial update check failed:', err));
  }, 30000); // Wait 30 seconds after startup
  
  // Setup periodic update checks
  updateCheckInterval = setInterval(() => {
    log.info('Performing scheduled update check...');
    autoUpdater.checkForUpdates()
      .catch(err => log.error('Scheduled update check failed:', err));
  }, updateCheckIntervalMs);
}

function cleanup() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

module.exports = {
  registerUpdaterHandlers,
  cleanup
}; 