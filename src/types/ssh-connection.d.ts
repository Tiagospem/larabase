import { MysqlConnection } from './mysql-connection';

export interface SshConnection {
	name?: string;
	host: string;
	port: number;
	user: string;
	password?: string;
	privateKey?: string;
	passphrase?: string;
	remotePath: string;
	remoteDbType: 'mysql';
	remoteDbConfig: MysqlConnection;
}

export interface AppConnection {
	localDbConfig: MysqlConnection;
	remote?: SshConnection;
}
