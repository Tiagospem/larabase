export interface MysqlConnection {
	host: string;
	port: number;
	user: string;
	password?: string;
	database: string;
}