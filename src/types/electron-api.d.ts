import { SshConnection } from './ssh-connection';

interface IpcRendererAPI {
	on(channel: string, func: (...args: any[]) => void): void;
	once(channel: string, func: (...args: any[]) => void): void;
	removeListener(channel: string, func: (...args: any[]) => void): void;
	removeAllListeners(channel: string): void;
	send(channel: string, ...args: any[]): void;
	invoke(channel: string, ...args: any[]): Promise<any>;

	// Update functions
	checkForUpdates: () => Promise<any>;
	downloadUpdate: () => Promise<any>;
	quitAndInstall: () => Promise<any>;
	getCurrentVersion: () => Promise<string>;
	openExternal: (url: string) => Promise<void>;
	checkInternetConnection: () => Promise<boolean>;
	onUpdateStatus: (callback: Function) => () => void;

	git: {
		getStatus: (projectPath: string) => Promise<{
			isGitInstalled: boolean;
			hasRepository: boolean;
			currentBranch: string;
			errorMessage?: string;
		}>;
		initRepository: (projectPath: string) => Promise<boolean>;
	};

	ssh: {
		testConnection: (
			config: SshConnection
		) => Promise<{ success: boolean; message: string }>;
		executeCommand: (
			config: SshConnection,
			command: string
		) => Promise<{
			stdout: string;
			stderr: string;
			code: number | null;
		}>;
		readFile: (
			config: SshConnection,
			filePath: string
		) => Promise<{
			success: boolean;
			content?: string;
			error?: string;
		}>;
		writeFile: (
			config: SshConnection,
			filePath: string,
			content: string
		) => Promise<{
			success: boolean;
			error?: string;
		}>;
		listFiles: (
			config: SshConnection,
			dirPath: string
		) => Promise<{
			success: boolean;
			files?: any[];
			error?: string;
		}>;
		closeConnection: (
			config: SshConnection
		) => Promise<{ success: boolean }>;
		createTunnel: (
			config: SshConnection,
			remoteHost: string,
			remotePort: number,
			localPort?: number
		) => Promise<{
			success: boolean;
			tunnelId?: string;
			localPort?: number;
			error?: string;
		}>;
		closeTunnel: (tunnelId: string) => Promise<{ success: boolean }>;

		// Optimized SSH methods
		optimizedList: (
			config: SshConnection,
			dirPath: string
		) => Promise<{
			success: boolean;
			files?: any[];
			error?: string;
		}>;
		optimizedRead: (
			config: SshConnection,
			filePath: string,
			length?: number
		) => Promise<{
			success: boolean;
			content?: string;
			error?: string;
		}>;
		optimizedWrite: (
			config: SshConnection,
			filePath: string,
			content: string
		) => Promise<{
			success: boolean;
			error?: string;
		}>;
		optimizedExists: (
			config: SshConnection,
			path: string
		) => Promise<{
			success: boolean;
			exists: boolean;
			error?: string;
		}>;
		connectionStats: () => Promise<{
			total: number;
			inUse: number;
			available: number;
		}>;
	};
}

declare global {
	interface Window {
		ipcRenderer: IpcRendererAPI;
	}
}
