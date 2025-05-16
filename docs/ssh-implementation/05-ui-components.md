# Step 5: Update UI Components for SSH

This step involves updating the UI components to support SSH remote connections in Larabase.

## Completed Tasks

1. Created the `SshConnectionForm.vue` component with:

    - Host, port, and username fields for SSH connection
    - Authentication method selection (password or private key)
    - Remote project path configuration
    - Remote database configuration for MySQL/PostgreSQL
    - Test connection functionality

2. Updated `ManageConnection.vue` to:

    - Import and use the SshConnectionForm component
    - Add connection type selector (MySQL local vs SSH remote)
    - Handle SSH connection validation and testing
    - Support saving SSH connection data
    - Make the UI conditional based on connection type

3. Updated `Home.vue` to:

    - Display SSH connections with appropriate styling
    - Add a "Remote" badge for remote connections
    - Show the appropriate server and database information

4. Updated the connections store to:
    - Test SSH connections appropriately
    - Handle both local and remote connection types

## Implementation Details

### SshConnectionForm Component

The SshConnectionForm component provides a dedicated form for SSH connection settings, including:

- SSH server configuration (host, port, username)
- Authentication options:
    - Password-based authentication
    - Private key authentication with optional passphrase
- Remote project path specification
- Remote database configuration (MySQL or PostgreSQL)
- Connection testing functionality

### Connection Management Updates

The ManageConnection component was updated to handle both local and remote connections:

- A connection type selector allows users to choose between local and remote connections
- Form fields adapt based on the selected connection type
- Validation logic is specific to each connection type
- Connection testing routes to the appropriate endpoint based on type

### Home View Updates

The Home view now:

- Uses different styling for SSH connections
- Displays a "Remote" badge for remote connections
- Shows the appropriate server and database information

## Next Steps

1. Add remote indication badges to other parts of the UI
2. Implement remote file operations
3. Set up remote command execution
4. Complete SSH tunneling implementation for database connections

## Code Files Modified

- `/src/components/home/SshConnectionForm.vue` (Created)
- `/src/components/home/ManageConnection.vue` (Updated)
- `/src/views/Home.vue` (Updated)
- `/src/store/connections.ts` (Updated)

## Related Types

The implementation uses these key types:

- `SshConnection` from `/src/types/ssh-connection.d.ts`
- `ConnectionType` enum from `/src/types/connection-types.ts`
- `ProjectConnection` from `/src/types/project.d.ts` (with SSH support)
