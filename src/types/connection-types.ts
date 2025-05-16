export enum ConnectionType {
	MySQL = 'mysql',
	PostgreSQL = 'postgresql',
	SSH = 'ssh'
}

export function getConnectionTypeIcon(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'M';
		case ConnectionType.PostgreSQL:
			return 'P';
		case ConnectionType.SSH:
			return 'S';
		default:
			return '';
	}
}

export function getConnectionTypeColor(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'bg-primary';
		case ConnectionType.PostgreSQL:
			return 'bg-secondary';
		case ConnectionType.SSH:
			return 'bg-accent';
		default:
			return 'bg-neutral';
	}
}

export function getConnectionTypeLabel(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'MySQL';
		case ConnectionType.PostgreSQL:
			return 'PostgreSQL';
		case ConnectionType.SSH:
			return 'SSH Remote';
		default:
			return 'Unknown';
	}
}
