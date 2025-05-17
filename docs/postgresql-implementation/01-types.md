# Step 1: Create PostgreSQL Types

In this step, we'll create the necessary TypeScript type definitions for PostgreSQL connections.

## Tasks

- [ ] Create PostgreSQL connection type definition
- [ ] Update project connection type to support PostgreSQL

## Implementation Details

### 1. Create PostgreSQL Connection Type

Create a new file `src/types/postgresql-connection.d.ts` with the following content:

```typescript
export interface PostgresqlConnection {
	database: string;
	host: string;
	port: number;
	user: string;
	password: string;
	schema?: string; // PostgreSQL has schema concept
	ssl?: boolean; // SSL connection option
	connectTimeout?: number;
}
```

### 2. Update Project Connection Type

Modify the `src/types/project.d.ts` file to support PostgreSQL connections:

```typescript
import { MysqlConnection } from './mysql-connection';
import { PostgresqlConnection } from './postgresql-connection'; // Add this import
import { RedisConnection } from './redis';
import { DockerInfo } from './docker-info';

export interface ProjectConnection {
	id?: string | null;
	name: string;
	projectPath: string;
	type: string; // Now can be 'mysql' or 'postgresql'
	icon: string | undefined | null;
	dbConfig: MysqlConnection | PostgresqlConnection; // Update this line
	redisConfig: RedisConnection;
	usingSail: boolean;
	status: string;
	isValid: boolean;
	dockerInfo?: DockerInfo | undefined | null;
}

// Rest of the file remains unchanged
```

## Verification

- Confirm both files have been created/updated correctly
- Ensure there are no TypeScript errors when building the project
- Verify imports resolve correctly

## Next Steps

After completing these tasks, proceed to [Step 2: Set Up PostgreSQL Helper Module](./02-helper-module.md).
