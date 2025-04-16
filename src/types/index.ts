// Basic TypeScript type definitions for the project

// Example of a generic response type
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Example of a database connection type
export interface DbConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'mongodb';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionString?: string;
  sshEnabled?: boolean;
  sshConfig?: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    passphrase?: string;
  };
}

// You can add more type definitions as you convert more of the codebase 