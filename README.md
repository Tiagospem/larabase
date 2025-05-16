<div align="center">
  <img src="public/icons/png/512x512.png" alt="Larabase Logo" width="200">
  <h1>Larabase</h1>
  <p>An Opinionated Database GUI for Laravel Developers</p>
</div>

## Overview

Larabase is a specialized desktop application built with Electron and Vue.js, designed specifically for Laravel developers. It enhances productivity by providing seamless integration with Laravel's project structure, database management, and developer workflow.

## Features

### Database Management

- **Connection Management**: Create, edit, and manage database connections
- **Table Visualization**: Browse table contents with sorting and filtering
- **Schema Explorer**: View database schema and relationships
- **Entity Relationship Diagram**: Visual ERD for database tables

### SQL Tools

- **Advanced SQL Editor**: With syntax highlighting using Monaco editor
- **SQL Query Execution**: Run and analyze SQL queries
- **Query History**: Track previously run queries
- **Explain Plans**: View SQL query execution plans

### Laravel Integration

- **Migration Management**: View, run, and roll back migrations
- **Artisan Command Interface**: Run Laravel artisan commands
- **Project Logs**: View and analyze Laravel log files
- **.env Editor**: Easily edit environment configuration

### Development Tools

- **Terminal Emulation**: Execute commands in an integrated terminal
- **Redis Manager**: View and manage Redis cache
- **Live Database Monitoring**: Watch database changes in real-time

### Additional Utilities

- **Database Restore/Dump**: Import and export database content
- **Theme Customization**: Light and dark mode support
- **Auto Updates**: Automated application update notifications

## Technology Stack

- **Electron**: Cross-platform desktop application framework
- **Vue.js 3**: Frontend framework with TypeScript
- **Pinia**: State management
- **Tailwind CSS & DaisyUI**: Styling
- **Monaco Editor**: Code editing experience
- **MySQL2**: Database connectivity
- **AI Integration**: SQL assistance with OpenAI and Google Generative AI

## Development

```bash
# Clone the repository
git clone https://github.com/Tiagospem/larabase.git

# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Build for specific platforms
npm run build:mac-apple   # macOS (Apple Silicon)
npm run build:mac-intel   # macOS (Intel)
npm run build:win         # Windows
npm run build:linux       # Linux
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Tiago Padilha <tiagospem@gmail.com>
