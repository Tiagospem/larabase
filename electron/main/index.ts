import { app, BrowserWindow, shell } from 'electron';
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
import { closeAllPools } from '../helpers/mysql';
import { closeAllConnections, closeAllTunnels } from '../helpers/ssh';

let handlersRegistered = false;

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

const openDevToolsOnInit: boolean = true;

let win: BrowserWindow | null = null;

const preload = path.join(__dirname, '../preload/index.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');

async function createWindow() {
	enhancePath();

	win = new BrowserWindow({
		title: 'Larabase',
		icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
		width: 1200,
		height: 800,
		minWidth: 1200,
		minHeight: 500,
		resizable: true,
		alwaysOnTop: false,
		center: true,
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload,
			nodeIntegration: true,
			contextIsolation: true
		}
	});

	registerHandlers(win);

	if (VITE_DEV_SERVER_URL) {
		await win.loadURL(VITE_DEV_SERVER_URL);

		if (openDevToolsOnInit) {
			win.webContents.openDevTools();
		}
	} else {
		await win.loadFile(indexHtml);
	}

	win.webContents.on('did-finish-load', () => {
		win?.webContents.send(
			'main-process-message',
			new Date().toLocaleString()
		);
	});

	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('https:')) shell.openExternal(url);
		return { action: 'deny' };
	});
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	win = null;

	cleanup();

	closeAllPools()
		.then()
		.catch((err) => {
			console.error('Error closing all pools:', err);
		})
		.finally(() => {
			closeAllConnections();
			closeAllTunnels();

			if (process.platform === 'darwin') app.quit();
		});
});

app.on('second-instance', () => {
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
});

app.on('activate', async () => {
	const allWindows = BrowserWindow.getAllWindows();
	if (allWindows.length) {
		allWindows[0].focus();
	} else {
		await createWindow();
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

	handlersRegistered = true;
}
