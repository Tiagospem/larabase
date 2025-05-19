export enum ConnectionType {
	MySQL = 'mysql',
	SSH = 'ssh'
}

export enum ConnectionStatus {
	Connected = 'connected',
	Disconnected = 'disconnected'
}

export function getConnectionTypeIcon(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'M';
		case ConnectionType.SSH:
			return 'S';
		default:
			return '';
	}
}

export function getConnectionTypeColor(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'bg-orange-500';
		case ConnectionType.SSH:
			return 'bg-purple-600';
		default:
			return 'bg-neutral';
	}
}

export function getConnectionTypeLabel(type: ConnectionType): string {
	switch (type) {
		case ConnectionType.MySQL:
			return 'MySQL';
		case ConnectionType.SSH:
			return 'SSH Remote';
		default:
			return 'Unknown';
	}
}
