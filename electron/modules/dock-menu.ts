import { ipcMain, Menu, app, BrowserWindow } from 'electron';
import { AppConnection } from '../../src/types/ssh-connection';
import { listDatabases } from '../helpers/mysql';
import fs from 'fs';
import path from 'path';

let currentConnectionId: string | null = null;
let currentAppConnection: AppConnection | null = null;
let availableDatabases: string[] = [];
let currentDatabase: string | null = null;
let projectDatabase: string | null = null;

function updateDockMenu() {
	if (process.platform !== 'darwin') {
		return;
	}

	if (
		!currentConnectionId ||
		!currentAppConnection ||
		availableDatabases.length === 0
	) {
		try {
			app.dock.setMenu(Menu.buildFromTemplate([]));
		} catch (error) {
			console.error('Error clearing dock menu:', error);
		}
		return;
	}

	const menuItems = availableDatabases.map((database) => ({
		label: database === currentDatabase ? `${database} ✓` : database,
		type: 'normal' as const,
		click: () => handleDatabaseSwitch(database)
	}));

	try {
		const menu = Menu.buildFromTemplate([
			{
				label: 'Switch Database',
				type: 'submenu',
				submenu: menuItems
			}
		]);

		app.dock.setMenu(menu);
	} catch (error) {
		console.error('Error setting dock menu:', error);
	}
}

async function updateEnvDatabase(projectPath: string, database: string) {
	try {
		if (!projectPath || !database) {
			return {
				success: false,
				message: 'Missing project path or database name'
			};
		}

		const envPath = path.join(projectPath, '.env');

		if (!fs.existsSync(envPath)) {
			return {
				success: false,
				message: '.env file not found in project'
			};
		}

		let envContent = fs.readFileSync(envPath, 'utf8');
		const lines = envContent.split('\n');
		let dbLineFound = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.trim().startsWith('#')) {
				continue;
			}

			if (line.trim().startsWith('DB_DATABASE=')) {
				lines[i] = `DB_DATABASE=${database}`;
				dbLineFound = true;
				break;
			}
		}

		if (!dbLineFound) {
			lines.push(`DB_DATABASE=${database}`);
		}

		const updatedContent = lines.join('\n');
		fs.writeFileSync(envPath, updatedContent);

		return {
			success: true,
			message: `Updated database to ${database} in .env file`
		};
	} catch (error: any) {
		return {
			success: false,
			message: error.message || 'Failed to update database in .env file'
		};
	}
}

async function handleDatabaseSwitch(databaseName: string) {
	if (
		!currentAppConnection ||
		!currentConnectionId ||
		databaseName === currentDatabase
	) {
		return;
	}

	try {
		currentAppConnection.localDbConfig.database = databaseName;
		currentDatabase = databaseName;

		let envUpdated = false;
		if (projectDatabase) {
			const envResult = await updateEnvDatabase(
				projectDatabase,
				databaseName
			);
			if (envResult.success) {
				envUpdated = true;
			} else {
				console.error('Failed to update .env file:', envResult.message);
			}
		}

		updateDockMenu();

		const windows = BrowserWindow.getAllWindows();

		windows.forEach((window) => {
			if (window.webContents) {
				window.webContents.send('database-switched', {
					connectionId: currentConnectionId,
					database: databaseName,
					success: true,
					envUpdated
				});
			}
		});
	} catch (error: any) {
		console.error('Failed to switch database from dock menu:', error);
	}
}

export function registerDockMenuHandlers() {
	ipcMain.handle(
		'dock-menu:set-connection',
		async (
			_,
			connectionId: string,
			appConnection: AppConnection,
			projectPath?: string
		) => {
			try {
				currentConnectionId = connectionId;
				currentAppConnection = appConnection;
				currentDatabase = appConnection.localDbConfig?.database || null;
				projectDatabase = projectPath || null;

				const result = await listDatabases(appConnection);
				if (result.success) {
					availableDatabases = result.databases;
					updateDockMenu();
				}

				return { success: true };
			} catch (error: any) {
				console.error('Error setting dock menu connection:', error);
				return { success: false, message: error.message };
			}
		}
	);

	ipcMain.handle('dock-menu:clear-connection', async () => {
		try {
			currentConnectionId = null;
			currentAppConnection = null;
			availableDatabases = [];
			currentDatabase = null;
			projectDatabase = null;
			updateDockMenu();
			return { success: true };
		} catch (error: any) {
			console.error('Error clearing dock menu connection:', error);
			return { success: false, message: error.message };
		}
	});

	ipcMain.handle(
		'dock-menu:update-databases',
		async (
			_,
			databases: string[],
			currentDb: string,
			projectDb?: string
		) => {
			try {
				availableDatabases = databases;
				currentDatabase = currentDb;
				projectDatabase = projectDb || null;
				updateDockMenu();
				return { success: true };
			} catch (error: any) {
				console.error('Error updating dock menu databases:', error);
				return { success: false, message: error.message };
			}
		}
	);

	ipcMain.handle('dock-menu:refresh', async () => {
		if (!currentAppConnection) {
			return { success: false, message: 'No active connection' };
		}

		try {
			const result = await listDatabases(currentAppConnection);
			if (result.success) {
				availableDatabases = result.databases;
				updateDockMenu();
			}
			return result;
		} catch (error: any) {
			console.error('Error refreshing dock menu databases:', error);
			return { success: false, message: error.message };
		}
	});
}
