export interface SshConnection {
	host: string;
	port: number;
	username: string;
	password?: string;
	privateKey?: string;
	passphrase?: string;
	remotePath: string;
	remoteDbType: 'mysql' | 'postgresql';
	remoteDbConfig: {
		host: string;
		port: number;
		database: string;
		username: string;
		password?: string;
		schema?: string;
	};
}
