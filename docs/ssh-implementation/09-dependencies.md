# Step 9: Install Dependencies

In this step, we'll install and configure all the necessary dependencies for the SSH functionality in the application.

## Tasks

- [ ] Install SSH2 client library
- [ ] Install type definitions for SSH2
- [ ] Update package.json with new dependencies
- [ ] Configure build tools for native modules

## Implementation Details

### 1. Install SSH2 Client Library

The primary dependency for SSH support is the `ssh2` package, which is a pure JavaScript implementation of the SSH2 protocol. It provides all the functionality needed for SSH connections, tunneling, and file transfers.

Run the following command to install the package:

```bash
npm install ssh2
```

### 2. Install Type Definitions for SSH2

For proper TypeScript support, we need to install the type definitions for the SSH2 library:

```bash
npm install @types/ssh2 --save-dev
```

### 3. Update package.json

After installing the dependencies, verify that they're correctly added to your `package.json` file. It should contain the following entries:

```json
{
	"dependencies": {
		// ... existing dependencies
		"ssh2": "^1.11.0"
	},
	"devDependencies": {
		// ... existing dev dependencies
		"@types/ssh2": "^1.11.6"
	}
}
```

The version numbers may be different depending on the current releases of the packages.

### 4. Configure Electron for Native Modules

If you're using Electron Builder for packaging your application, you need to ensure it correctly handles the native modules used by SSH2. Add the following to your `electron-builder.yml` or equivalent configuration:

```yaml
npmRebuild: true
files:
    - '!node_modules/ssh2/**/*'
    - 'node_modules/ssh2/lib/**/*'
asar: true
asarUnpack:
    - 'node_modules/ssh2/**/*'
```

Or if you're using the configuration in `package.json`:

```json
{
	"build": {
		"npmRebuild": true,
		"files": ["!node_modules/ssh2/**/*", "node_modules/ssh2/lib/**/*"],
		"asar": true,
		"asarUnpack": ["node_modules/ssh2/**/*"]
	}
}
```

This ensures that Electron Builder correctly packages the SSH2 module and its dependencies.

### 5. Install Optional Dependencies for Enhanced Functionality

For enhanced SSH functionality, you may want to install the following optional dependencies:

#### 5.1. Install bcrypt for Improved Password Handling

```bash
npm install bcrypt
npm install @types/bcrypt --save-dev
```

This can be used for securely handling passwords when storing SSH credentials.

#### 5.2. Install node-forge for Key Management

```bash
npm install node-forge
npm install @types/node-forge --save-dev
```

This can be used for handling SSH key formats and conversions.

### 6. Verify Installation

After installing all dependencies, verify that everything is working correctly by building your application:

```bash
npm run build
```

If there are any errors related to the SSH2 package or its dependencies, you may need to install additional build tools or resolve conflicts.

## Troubleshooting Common Issues

### SSH2 Installation Issues

If you encounter issues installing the SSH2 package, it might be due to its native dependencies. Try the following:

1. Ensure you have the necessary build tools installed on your system:

    - On Windows: Install Visual Studio Build Tools with C++ support
    - On macOS: Install Xcode Command Line Tools
    - On Linux: Install the appropriate build tools (`build-essential` on Ubuntu/Debian)

2. If you're behind a proxy or have network issues, try:

    ```bash
    npm config set registry https://registry.npmjs.org/
    npm install ssh2 --no-proxy
    ```

3. If you're still having issues, you can try using a pre-built binary:
    ```bash
    npm install ssh2-prebuilt
    ```

### Electron Packaging Issues

If you encounter issues packaging the application with Electron Builder, try these solutions:

1. Make sure you're using a compatible version of Electron with the SSH2 package
2. Try rebuilding native modules for your Electron version:
    ```bash
    npx electron-rebuild -f -m ./node_modules/ssh2
    ```
3. Check if any other dependencies conflict with SSH2 and resolve those conflicts

## Verification

- Ensure all dependencies are correctly installed
- Verify that the application builds without errors
- Check that the SSH2 module is correctly packaged with Electron Builder
- Test basic SSH functionality to confirm everything is working

## Next Steps

After completing these tasks, proceed to [Step 10: Testing & Verification](./10-testing.md).
