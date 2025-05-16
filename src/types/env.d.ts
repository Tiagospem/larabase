import { DockerInfo } from './docker-info';

export interface Env {
	APP_NAME?: string;
	DB_HOST?: string;
	DB_PORT?: number;
	DB_DATABASE?: string;
	DB_USERNAME?: string;
	DB_PASSWORD?: string;
	DB_CONNECTION?: string;
	REDIS_HOST?: string;
	REDIS_PORT?: number;
	REDIS_PASSWORD?: string;
	DOCKER_INFO?: DockerInfo;
}
