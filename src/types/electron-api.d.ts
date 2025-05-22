import { SshConnection } from './ssh-connection';

interface IpcRendererAPI {
	// General IPC methods
	on(channel: string, func: (...args: any[]) => void): void;
	once(channel: string, func: (...args: any[]) => void): void;
	removeListener(channel: string, func: (...args: any[]) => void): void;
	removeAllListeners(channel: string): void;
	send(channel: string, ...args: any[]): void;
	invoke(channel: string, ...args: any[]): Promise<any>;

	// SSH Operations
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
		getEnv: (config: SshConnection) => Promise<{
			success: boolean;
			content?: string;
			error?: string;
		}>;
		updateEnv: (
			config: SshConnection,
			content: string
		) => Promise<{
			success: boolean;
			error?: string;
		}>;
		closeConnection: (
			config: SshConnection
		) => Promise<{ success: boolean }>;
		// Tunnel operations
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
	};
}

declare global {
	interface Window {
		ipcRenderer: IpcRendererAPI;
	}
}
