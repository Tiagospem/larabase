const {dialog, ipcMain} = require('electron');
const { getMainWindow } = require('../modules/window');

function selectSqlDumpFile() {
    ipcMain.handle('select-sql-dump-file', async () => {
        console.log('select-sql-dump-file');

        try {
            const mainWindow = getMainWindow();

            return await dialog.showOpenDialog(mainWindow, {
                title: 'Select SQL Dump File',
                buttonLabel: 'Select',
                filters: [{ name: 'SQL Dump Files', extensions: ['sql', 'gz'] }],
                properties: ['openFile']
            });
        } catch (error) {
            console.error('Error selecting SQL dump file:', error);
            throw error;
        }
    });
}

module.exports = {
    selectSqlDumpFile
}