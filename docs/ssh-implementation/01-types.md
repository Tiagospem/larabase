# Step 1: Create SSH Connection Types

In this step, we'll create the necessary TypeScript type definitions for SSH remote connections.

## Tasks

- [ ] Create SSH connection type definition
- [ ] Update project connection type to include SSH as a distinct connection type
- [ ] Define connection type enum for clear type identification

## Implementation Details

### 1. Create SSH Connection Type

Create a new file `src/types/ssh-connection.d.ts` with the following content:

```typescript
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
		schema?: string; // For PostgreSQL
	};
}
```

### 2. Create Connection Type Enum

Create a new file `src/types/connection-types.ts` to define the connection types:

```typescript
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
			return 'bg-orange-500';
		case ConnectionType.PostgreSQL:
			return 'bg-blue-600';
		case ConnectionType.SSH:
			return 'bg-green-600';
		default:
			return 'bg-gray-600';
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

export function isRemoteConnection(type: ConnectionType): boolean {
	return type === ConnectionType.SSH;
}
```

### 3. Update Project Connection Type

Modify the `src/types/project.d.ts` file to integrate the SSH connection type:

```typescript
import { MysqlConnection } from './mysql-connection';
import { PostgresqlConnection } from './postgresql-connection';
import { SshConnection } from './ssh-connection';
import { RedisConnection } from './redis';
import { DockerInfo } from './docker-info';
import { ConnectionType } from './connection-types';

export interface ProjectConnection {
	id?: string | null;
	name: string;
	projectPath: string;
	type: ConnectionType; // Change to enum type
	icon: string | undefined | null;
	isRemote: boolean; // Flag to indicate if the connection is remote

	// One of these will be used depending on the connection type
	db_config?: MysqlConnection | PostgresqlConnection;
	ssh_config?: SshConnection;

	redis_config: RedisConnection;
	usingSail: boolean;
	status: string;
	isValid: boolean;
	dockerInfo?: DockerInfo | undefined | null;
}

// Rest of the file remains unchanged
```

## Verification

- Confirm all type definition files have been created/updated correctly
- Ensure there are no TypeScript errors when building the project
- Verify imports resolve correctly

## Next Steps

After completing these tasks, proceed to [Step 2: Set Up SSH Helper Module](./02-helper-module.md).
