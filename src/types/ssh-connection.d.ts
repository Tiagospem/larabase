export interface SshConnection {
	name?: string; // Connection name
	host: string;
	port: number;
	username: string;
	password?: string;
	privateKey?: string;
	passphrase?: string;
	remotePath: string;
	remoteDbType: 'mysql'; // Only MySQL is supported
	remoteDbConfig: {
		host: string;
		port: number;
		database: string;
		username: string;
		password?: string;
	};
}
