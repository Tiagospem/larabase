export interface RedisConnection {
  host: string;
  port: number | string;
  password: string | undefined;
}
