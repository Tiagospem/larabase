import { ipcMain } from 'electron';
import Store from 'electron-store';

function registerSettingsHandlers(store: Store) {
  ipcMain.handle('get-settings', () => {
    try {
      return store.get('settings');
    } catch (error) {
      console.error('Error retrieving settings:', error);

      return null;
    }
  });

  ipcMain.handle('save-settings', (_, settings) => {
    try {
      store.set('settings', settings);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);

      throw error;
    }
  });
}

export { registerSettingsHandlers };
