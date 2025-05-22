# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Larabase is an Electron desktop application specifically designed for Laravel developers. It's an opinionated database GUI tool with seamless Laravel integration, providing specialized features for Laravel project development workflows.

## Key Commands

### Development

```bash
# Start development server
npm run dev

# Build for current platform
npm run build

# Platform-specific builds
npm run build:mac-apple   # macOS (Apple Silicon)
npm run build:mac-intel   # macOS (Intel)
npm run build:win         # Windows
npm run build:linux       # Linux

# Code Quality
npm run lint              # Run ESLint with auto-fix
npm run format            # Run Prettier formatter
```

## Architecture Overview

Larabase follows the standard Electron architecture with main and renderer processes:

### Main Process (`electron/`)

- **Main Entry:** `electron/main/index.ts` - Application initialization, window management
- **Modules:** `electron/modules/` - Backend functionality implemented as service modules
    - Database operations (`mysql.ts`, `tables.ts`, `sql-executor.ts`)
    - SSH tunneling (`ssh.ts`)
    - Redis integration (`redis.ts`)
    - Project management (`projects.ts`)
    - Terminal emulation (`terminal.ts`)
    - Git integration (`git.ts`)
- **Helpers:** `electron/helpers/` - Utility functions for various operations

### Renderer Process (`src/`)

- **Components:** `src/components/` - Vue.js UI components organized by functionality
- **State Management:** `src/store/` - Pinia stores for application state
- **Services:** `src/services/` - API communication and frontend services
- **Types:** `src/types/` - TypeScript interfaces and type definitions

### Communication Pattern

The application follows a communication pattern using Electron's IPC:

1. Front-end requests through `window.electron.ipcRenderer.invoke(channel, ...args)`
2. Backend handles via IPC handlers registered in modules
3. Results returned to front-end asynchronously

## Key Features & Implementation

### Database Connections

- Supports direct MySQL connections and SSH tunneling
- Connection details stored securely via electron-store
- SSH tunneling implemented using ssh2 library and dynamic port forwarding

### Query Management

- Monaco editor for SQL editing with syntax highlighting
- SQL execution handled through mysql2 library
- Results displayed in Vue data table components with sorting/filtering

### Laravel Integration

- Specialized views for Laravel-specific database operations
- Migration management interface
- .env file editor
- Terminal integration for running Artisan commands
- Git integration with branch visibility and repository management

### Redis Support

- Redis database browsing and management
- Key-value storage interaction
- Cache management operations

## Data Flow

1. User interacts with Vue UI components
2. Actions trigger state changes in Pinia stores
3. Stores dispatch IPC calls to Electron backend
4. Backend modules execute operations and return results
5. UI updates based on returned data
6. Always use preload file to expose necessary APIs to the renderer process
7. Do not comment on the code unless extremely necessary to avoid polluting the codebase
8. Always create a module in the electron/modules for grouped functionality (e.g., database, SSH, Redis) to maintain organization

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **Vue.js 3**: Frontend framework with TypeScript
- **Pinia**: State management
- **Tailwind CSS & DaisyUI**: Styling
- **Monaco Editor**: Code editor component
- **MySQL2**: Database connectivity
- **SSH2**: SSH tunneling support
- **IoRedis**: Redis client functionality

## Code Tips and Tricks

- Always use toRaw for reactive objects to avoid errors like "An object could not be cloned."
- Use separate loading states for initial loading vs. background refreshes to avoid UI flickering

## Git Integration

The application includes Git integration features:

- Git branch visibility in the MainHeader component for local connections
- Git repository status detection (checks if Git is installed and if the directory is a Git repository)
- Ability to initialize a new Git repository directly from the UI
- Auto-refresh of Git information every 5 seconds to keep branch information current
- Backend implementation in `electron/modules/git.ts` providing Git operations via IPC
