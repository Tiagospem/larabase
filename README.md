# Larabase

<div align="center">
  <img src="./src/renderer/assets/icons/png/512x512.png" alt="Larabase Logo" width="200" />
</div>

Larabase is a powerful database management tool designed specifically for Laravel developers. It provides a comprehensive environment for managing your MySQL databases, Redis instances, and Laravel application functionality in a single, elegant interface.

## Features

### Database Management

- **Full MySQL Integration**: Connect to and manage MySQL databases with an intuitive interface
- **Database Explorer**: Browse, search, and filter database tables and content
- **Data Manipulation**: View, edit, and delete records directly in the application
- **Table Structure Visualization**: Examine table schemas, indexes, and relationships
- **SQL Editor**: Execute custom SQL queries with syntax highlighting
- **Query Explain Tool**: Analyze and optimize query performance
- **Database Diagram**: Visualize relationships between tables
- **Auto-Detection**: Docker and local MySQL instance detection

### Laravel Integration

- **Project Connection**: Associate Laravel projects with database connections
- **Migration Management**: View, run, and rollback migrations through the UI
- **Command Execution**: Run Laravel Artisan commands with custom flags
- **Model Discovery**: Auto-detect Laravel models associated with database tables
- **Factory Management**: View and use factories to generate test data
- **Project Log Viewer**: Access Laravel logs directly in the application
- **Redis Management**: Connect to and manage Redis instances

### Application Features

- **Dark-themed Interface**: Clean, modern design inspired by TablePlus
- **Tab-based Navigation**: Efficiently work with multiple tables and views simultaneously
- **Resizable Components**: Customize your workspace with adjustable panels
- **Live Updates**: Monitor database changes in real-time
- **State Persistence**: Session state is saved between application reloads
- **Docker Support**: Seamless integration with Laravel Sail and Docker environments

## Requirements

- Node.js 16+
- npm or yarn
- MySQL (local or Docker)
- Laravel project (optional, for enhanced features)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/larabase.git
cd larabase
npm install
```

## Development

Run in development mode:

```bash
npm run dev
```

This will start the Vite development server and launch Electron.

## Building

Build the application:

```bash
npm run build
```

## Troubleshooting

### macOS Malware Alert

Some macOS users might encounter the following warning when using Docker or OrbStack features:

```
Malware Blocked
"Docker" was not opened because it contains malware. This action did not harm your Mac.
```

This is triggered by macOS Gatekeeper security system, which sometimes incorrectly flags Docker/OrbStack as suspicious. Here's how to resolve it:

#### Option 1: Allow via Security Settings

1. When the alert appears, go to System Preferences > Security & Privacy > General tab
2. Look for a message about Docker/OrbStack being blocked
3. Click "Allow Anyway" or "Open Anyway"

#### Option 2: Reinstall from Official Source

1. Download Docker Desktop from the [official website](https://www.docker.com/products/docker-desktop/)
2. Download OrbStack from the [official website](https://orbstack.dev/)
3. Uninstall your current version before installing the new one

#### Option 3: Remove Quarantine Flag (Advanced)

Run this command in Terminal:

```bash
xattr -d com.apple.quarantine /Applications/Docker.app
# Or for OrbStack
xattr -d com.apple.quarantine /Applications/OrbStack.app
```

#### Option 4: Update to Latest Version

The latest versions of Docker Desktop and OrbStack are properly signed and generally avoid these issues.

## Project Structure

- `src/main`: Electron code (main process)
  - `modules`: Core functionality modules
  - `handlers`: IPC communication handlers
- `src/renderer`: Vue.js code (renderer process)
  - `views`: Application pages
  - `components`: Reusable components
  - `store`: Pinia stores
  - `assets`: Static resources

## Key Components

- **Database View**: Main interface for database management
- **SQL Editor**: Powerful query execution environment
- **Migration UI**: Interface for Laravel migration management
- **Laravel Commands**: Tool for executing Artisan commands
- **Redis Manager**: Interface for Redis operations
- **Project Logs**: Viewer for Laravel application logs
- **Database Diagram**: Visual representation of database relationships

## Unique Features

- **Laravel-Centric Design**: Built specifically for Laravel developers
- **Project Integration**: Seamlessly connects to your Laravel project
- **Command-Line Interface**: Run and manage Artisan commands without leaving the app
- **Real-time Updates**: Monitor database activity as it happens
- **Comprehensive Environment**: Single tool for database, Redis, and project management

## License

MIT
