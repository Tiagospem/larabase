import { MysqlConnection } from './mysql-connection';

export interface SSHConfig {
	host: string;
	port: number;
	user: string;
	password?: string;
	privateKey?: string;
	passphrase?: string;
	remoteDbType: 'mysql';
	remoteDbConfig: MysqlConnection;
}
