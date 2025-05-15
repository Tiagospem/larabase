export interface MysqlConnection {
  database: string;
  host: string;
  port: number;
  user: string;
  password: string;
  connectTimeout?: number;
}

export interface ForeignKey {
  column: string;
  name: string;
  on_delete: string;
  on_update: string;
  referenced_column: string;
  referenced_table: string;
  type: 'outgoing' | 'incoming';
}
