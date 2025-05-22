import { app, BrowserWindow, shell, ipcMain } from 'electron';
import Store from 'electron-store';
import { fileURLToPath } from 'node:url';
import enhancePath from '../helpers/enhance-path';
import path from 'node:path';
import os from 'node:os';
import { registerProjectHandlers } from '../modules/projects';
import { registerMysqlHandlers } from '../modules/mysql';
import { registerSettingsHandlers } from '../modules/settings';
import { registerDatabaseRestoreHandlers } from '../modules/database-restore';
import { registerRedisHandlers } from '../modules/redis';
import { registerTablesHandlers } from '../modules/tables';
import { registerPasswordHandlers } from '../modules/password';
import { registerTerminalHandlers } from '../modules/terminal';
import { registerMonitoringHandlers } from '../modules/monitoring';
import { registerMigrationHandlers } from '../modules/migrations';
import { registerSqlExecutorHandlers } from '../modules/sql-executor';
import { registerUpdaterHandlers, cleanup } from '../modules/updater';
import { registerSshHandlers } from '../modules/ssh';
import { registerGitHandlers } from '../modules/git';
import { closeAllPools } from '../helpers/mysql';
import { closeAllConnections, closeAllTunnels } from '../helpers/ssh';

let handlersRegistered = false;
let isQuitting = false;

const store = new Store();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '../..');

export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
	? path.join(process.env.APP_ROOT, 'public')
	: RENDERER_DIST;

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
	app.quit();
	process.exit(0);
}

const openDevToolsOnInit: boolean = false;

let homeWindow: BrowserWindow | null = null;

const connectionWindows = new Map<string, BrowserWindow>();

const sqlEditorWindows = new Map<string, BrowserWindow[]>();

const preload = path.join(__dirname, '../preload/index.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');

async function createHomeWindow() {
	enhancePath();

	homeWindow = new BrowserWindow({
		title: 'Larabase',
		icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
		width: 1200,
		height: 800,
		minWidth: 1200,
		minHeight: 500,
		resizable: true,
		center: true,
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload,
			nodeIntegration: true,
			contextIsolation: true
		}
	});

	registerHandlers(homeWindow);

	if (VITE_DEV_SERVER_URL) {
		await homeWindow.loadURL(VITE_DEV_SERVER_URL);

		if (openDevToolsOnInit) {
			homeWindow.webContents.openDevTools();
		}
	} else {
		await homeWindow.loadFile(indexHtml);
	}

	homeWindow.webContents.on('did-finish-load', () => {
		homeWindow?.webContents.send(
			'main-process-message',
			new Date().toLocaleString()
		);
	});

	homeWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:')) shell.openExternal(url);
		return { action: 'deny' };
	});

	homeWindow.on('closed', () => {
		homeWindow = null;
	});

	homeWindow.on('close', (e) => {
		if (!isQuitting && process.platform === 'darwin') {
			e.preventDefault();
			homeWindow?.hide();
			return;
		}

		// If we're quitting the app and this is the last window, close all connections
		if (isQuitting && connectionWindows.size === 0) {
			performCleanup();
		}
	});
}

async function createConnectionWindow(connectionId: string, isRemote: boolean) {
	for (const [id, window] of Array.from(connectionWindows.entries())) {
		closeAllSqlEditorsForConnection(id);

		window.close();
		connectionWindows.delete(id);
	}

	const connectionWindow = new BrowserWindow({
		title: `Larabase - Connection ${connectionId}`,
		icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
		width: 1280,
		height: 900,
		minWidth: 1200,
		minHeight: 600,
		resizable: true,
		center: true,
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload,
			nodeIntegration: true,
			contextIsolation: true
		},
		show: false
	});

	registerHandlers(connectionWindow);

	let url = VITE_DEV_SERVER_URL
		? `${VITE_DEV_SERVER_URL}#/database/${connectionId}/${isRemote}`
		: `file://${indexHtml}#/database/${connectionId}/${isRemote}`;

	await connectionWindow.loadURL(url);

	connectionWindow.show();

	if (openDevToolsOnInit) {
		connectionWindow.webContents.openDevTools();
	}

	connectionWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:')) shell.openExternal(url);
		return { action: 'deny' };
	});

	connectionWindow.on('closed', () => {
		closeAllSqlEditorsForConnection(connectionId);

		connectionWindows.delete(connectionId);

		if (!homeWindow) {
			createHomeWindow();
		} else {
			homeWindow.show();
		}
	});

	connectionWindows.set(connectionId, connectionWindow);

	connectionWindow.on('close', (e) => {
		if (
			isQuitting &&
			process.platform !== 'darwin' &&
			!homeWindow &&
			connectionWindows.size === 1
		) {
			// This is the last window and we're quitting
			performCleanup();
		}
	});

	return connectionWindow;
}

async function createSqlEditorWindow(connectionId: string, isRemote: boolean) {
	const sqlEditorWindow = new BrowserWindow({
		title: `Larabase - SQL Editor ${connectionId}`,
		icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
		width: 1280,
		height: 900,
		minWidth: 1200,
		minHeight: 600,
		resizable: true,
		center: true,
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload,
			nodeIntegration: true,
			contextIsolation: true
		},
		show: false
	});

	registerHandlers(sqlEditorWindow);

	let url = VITE_DEV_SERVER_URL
		? `${VITE_DEV_SERVER_URL}#/sql-editor/${connectionId}/${isRemote}`
		: `file://${indexHtml}#/sql-editor/${connectionId}/${isRemote}`;

	await sqlEditorWindow.loadURL(url);

	sqlEditorWindow.show();

	if (openDevToolsOnInit) {
		sqlEditorWindow.webContents.openDevTools();
	}

	sqlEditorWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:')) shell.openExternal(url);
		return { action: 'deny' };
	});

	if (!sqlEditorWindows.has(connectionId)) {
		sqlEditorWindows.set(connectionId, []);
	}

	sqlEditorWindows.get(connectionId)?.push(sqlEditorWindow);

	sqlEditorWindow.on('closed', () => {
		const windows = sqlEditorWindows.get(connectionId) || [];
		const index = windows.indexOf(sqlEditorWindow);
		if (index !== -1) {
			windows.splice(index, 1);
		}

		if (windows.length === 0) {
			sqlEditorWindows.delete(connectionId);
		}
	});

	return sqlEditorWindow;
}

function updatePendingMigrationsBadge(count: number) {
	if (process.platform === 'darwin') {
		const displayCount =
			count > 0 ? (count >= 100 ? '99' : count.toString()) : '';
		app.dock.setBadge(displayCount);
	} else if (process.platform === 'win32' || process.platform === 'linux') {
		const displayCount = count > 0 ? (count >= 100 ? 99 : count) : 0;
		app.setBadgeCount(displayCount);
	}
}

function registerWindowHandlers() {
	ipcMain.handle('update-migrations-badge', (_, count) => {
		updatePendingMigrationsBadge(count);
		return true;
	});

	ipcMain.handle(
		'open-connection-window',
		async (_, connectionId, isRemote) => {
			const window = await createConnectionWindow(connectionId, isRemote);

			if (homeWindow) {
				homeWindow.hide();
			}

			return !!window;
		}
	);

	ipcMain.handle('close-connection-window', (_, connectionId) => {
		const window = connectionWindows.get(connectionId);
		if (window) {
			window.close();
			return true;
		}
		return false;
	});

	ipcMain.handle(
		'open-sql-editor-window',
		async (_, connectionId, isRemote) => {
			const window = await createSqlEditorWindow(connectionId, isRemote);
			return !!window;
		}
	);

	ipcMain.handle('show-home-window', async () => {
		for (const [id, window] of Array.from(connectionWindows.entries())) {
			closeAllSqlEditorsForConnection(id);

			if (!window.isDestroyed()) {
				window.close();
			}
			connectionWindows.delete(id);
		}

		if (!homeWindow) {
			await createHomeWindow();
		} else {
			if (homeWindow.isMinimized()) {
				homeWindow.restore();
			}
			homeWindow.show();
			homeWindow.focus();
		}
		return true;
	});

	ipcMain.handle('get-window-id', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win === homeWindow) return 'home';

		for (const [id, window] of Array.from(connectionWindows.entries())) {
			if (window === win) return id;
		}

		return null;
	});

	ipcMain.handle('app-quit', async () => {
		isQuitting = true;
		app.quit();
		return true;
	});
}

// Function to clean up all connections and resources
async function performCleanup() {
	cleanup();

	try {
		await closeAllPools();
	} catch (err) {
		console.error('Error closing all MySQL pools:', err);
	}

	try {
		closeAllConnections();
	} catch (err) {
		console.error('Error closing all SSH connections:', err);
	}

	try {
		closeAllTunnels();
	} catch (err) {
		console.error('Error closing all SSH tunnels:', err);
	}
}

app.whenReady().then(async () => {
	await createHomeWindow();
	registerWindowHandlers();
});

app.on('before-quit', (e) => {
	isQuitting = true;
});

app.on('window-all-closed', () => {
	homeWindow = null;
	connectionWindows.clear();

	performCleanup()
		.then(() => {
			if (process.platform !== 'darwin') {
				app.exit(0);
			}
		})
		.catch((err) => {
			console.error('Error during cleanup:', err);
			app.exit(1);
		});
});

app.on('second-instance', () => {
	if (homeWindow) {
		if (homeWindow.isMinimized()) homeWindow.restore();
		homeWindow.focus();
	} else if (connectionWindows.size > 0) {
		const firstWindow = connectionWindows.values().next().value;
		if (firstWindow) {
			if (firstWindow.isMinimized()) firstWindow.restore();
			firstWindow.focus();
		}
	}
});

app.on('activate', async () => {
	if (homeWindow) {
		homeWindow.focus();
	} else if (connectionWindows.size > 0) {
		const firstWindow = connectionWindows.values().next().value;
		if (firstWindow) {
			firstWindow.focus();
		}
	} else {
		await createHomeWindow();
	}
});

function registerHandlers(win: BrowserWindow) {
	if (handlersRegistered) return;

	registerDatabaseRestoreHandlers(win);
	registerMonitoringHandlers(win);
	registerProjectHandlers(win);
	registerSettingsHandlers(store);
	registerTablesHandlers();
	registerMysqlHandlers();
	registerRedisHandlers();
	registerPasswordHandlers();
	registerTerminalHandlers();
	registerMigrationHandlers();
	registerSqlExecutorHandlers();
	registerUpdaterHandlers(win);
	registerSshHandlers();
	registerGitHandlers();

	handlersRegistered = true;
}

function closeAllSqlEditorsForConnection(connectionId: string) {
	const editorWindows = sqlEditorWindows.get(connectionId) || [];

	const windowsToClose = [...editorWindows];

	for (const window of windowsToClose) {
		if (window && !window.isDestroyed()) {
			window.close();
		}
	}

	sqlEditorWindows.delete(connectionId);
}
