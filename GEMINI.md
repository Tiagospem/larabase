# Gemini Project Description

This document provides a comprehensive overview of the Larabase project, an opinionated database GUI for Laravel developers.

## Project Overview

Larabase is a desktop application built with Electron and Vue.js, designed to streamline the workflow of Laravel developers. It offers a suite of tools for database management, SQL editing, and seamless integration with Laravel-specific features.

### Key Features

- **Database Management**: Manage connections, browse tables, and view schemas.
- **SQL Editor**: Advanced editor with syntax highlighting and query execution.
- **Laravel Integration**: Run Artisan commands, manage migrations, and edit `.env` files.
- **Development Tools**: Integrated terminal, Redis manager, and real-time database monitoring.
- **SSH Tunneling**: Securely connect to remote databases via SSH.

## Technology Stack

- **Frameworks**: Electron, Vue.js 3
- **Languages**: TypeScript
- **Styling**: Tailwind CSS, DaisyUI
- **State Management**: Pinia
- **Database**: MySQL2
- **Code Editor**: Monaco Editor
- **AI Integration**: OpenAI, Google Generative AI

## Project Structure

The project is organized into the following main directories:

- `electron/`: Contains the main process code for the Electron application.
- `src/`: Contains the renderer process code, including Vue components, services, and assets.
- `public/`: Static assets that are copied directly to the build output.
- `dist/`: Build output for the renderer process.
- `dist-electron/`: Build output for the main process.

## Development Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run lint`: Lints the codebase.
- `npm run format`: Formats the code.

## Build and Deployment

The application is built using `electron-builder` and can be packaged for macOS, Windows, and Linux. The build configuration is defined in `package.json`.

## SSH Tunneling

The application supports SSH tunneling to connect to remote databases. This is implemented using the `ssh2` library for creating secure connections and port forwarding.

## AI Integration

Larabase integrates with OpenAI and Google Generative AI to provide SQL assistance and other AI-powered features. This is managed through the `aiService.ts` service.

## Project Guidance

This section provides guidance for contributing to the Larabase project.

### Coding Style

The project follows a strict coding style enforced by Prettier and ESLint.

- **Formatting**: Code is automatically formatted using Prettier. Key style points include:
  - Single quotes are used for strings.
  - Lines have a maximum width of 80 characters.
  - Tabs are used for indentation, with a width of 4 spaces.
  - Trailing commas are not used.
  - Brackets have spaces around them.
  - Each attribute is on a single line.
  - Semicolons are required at the end of statements.
- **Linting**: ESLint is used to catch code quality issues. The configuration is based on `eslint:recommended` and includes plugins for TypeScript, Vue, and unused imports.

Before committing any code, please run the following commands to ensure your code adheres to the project's style:

```bash
npm run format
npm run lint
```

### Commit Message Conventions

Commit messages should follow the Conventional Commits specification. This provides a clear and consistent history of the project.

The format is as follows:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

- **type**: Must be one of the following:
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation only changes
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
  - `refactor`: A code change that neither fixes a bug nor adds a feature
  - `perf`: A code change that improves performance
  - `test`: Adding missing tests or correcting existing tests
  - `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation
- **scope**: An optional, parenthesized scope to provide additional contextual information.
- **description**: A short, imperative-tense description of the change.

**Examples from the project's history:**

- `chore: update macOS version in CI workflow from 'macos-latest' to 'macos-13'`
- `fix: correct record ID reference and enable input fields in EditRecordModal`
- `feat: add functionality to save and load column widths in DataTable component`

### Testing

While the project currently lacks a dedicated test suite, we encourage the addition of tests for new features and bug fixes. When adding tests, please use a testing framework that is compatible with the existing technology stack (e.g., Vitest for Vue components).
