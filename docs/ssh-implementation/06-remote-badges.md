# Step 6: Add Remote Indication Badges

This step enhances the UI to clearly indicate which projects or database connections are remote versus local by implementing badges and visual indicators throughout the application.

## Completed Tasks

- [x] Created a reusable remote badge component
- [x] Updated project list to display remote badges
- [x] Added remote indicators to database views
- [x] Added remote indicators to connection info displays
- [x] Implemented SSH information display in connection details

## Implementation Details

### 1. Created a Reusable Remote Badge Component

Created a new `RemoteBadge.vue` component that provides a consistent way to display remote connection status with:

```vue
<template>
	<div
		class="badge badge-sm"
		:class="[size === 'lg' ? 'badge-lg' : '', getColorClass()]"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			class="w-3 h-3 mr-1"
		>
			<path
				fill-rule="evenodd"
				d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
				clip-rule="evenodd"
			/>
		</svg>
		{{ label }}
	</div>
</template>

<script lang="ts" setup>
const props = defineProps<{
	type?: 'remote' | 'local';
	size?: 'sm' | 'lg';
	label?: string;
}>();

// Default values
const type = props.type || 'remote';
const label = props.label || (type === 'remote' ? 'REMOTE' : 'LOCAL');

function getColorClass(): string {
	return type === 'remote'
		? 'bg-green-600 text-white'
		: 'bg-blue-600 text-white';
}
</script>
```

The component supports:

- Different sizes via the `size` prop
- Configurable labels via the `label` prop
- Different types with distinct styling

### 2. Updated Project List in Home View

Updated the home view (`Home.vue`) to clearly display remote badges for SSH connections:

```vue
<h2 class="card-title overflow-hidden text-ellipsis whitespace-nowrap">
    <span>{{ connection.name }}</span>
    <RemoteBadge v-if="connection.isRemote" />
</h2>
```

### 3. Added Remote Indicators to Database View

Updated `DatabaseView.vue` to show remote connection status through the header component:

```vue
<MainHeader
	@open-settings="ui.showSettings = true"
	@open-database-switcher="ui.showDatabaseSwitcher = true"
	@open-live-updates="ui.showLiveUpdates = true"
	@open-project-logs="ui.showProjectLogs = true"
	@open-migrations="ui.showMigrations = true"
	@open-env-editor="ui.showEnvEditor = true"
	:pending-migrations="pendingMigrationsCount"
	@goBack="handleGoBack"
>
    <template #connection-indicator v-if="isRemoteConnection">
        <RemoteBadge size="lg" />
    </template>
</MainHeader>
```

Added a new slot in `MainHeader.vue` to display the remote badge next to the connection info.

### 4. Enhanced Connection Information Display

Updated `ShowConnectionInfo.vue` to display remote badges in both the header and in detailed connection info:

```vue
<h1 class="text-lg font-semibold flex items-center">
    {{ projectStore.selectedProject.name }}
    <RemoteBadge 
        v-if="projectStore.selectedProject.isRemote" 
        class="ml-2" 
    />
</h1>
```

Added SSH configuration details to the connection information modal:

```vue
<div v-if="projectStore.selectedProject?.isRemote && projectStore.selectedProject?.ssh_config">
    <div class="divider">SSH Information</div>
    <p>
        <strong>SSH Host:</strong>
        {{ projectStore.selectedProject.ssh_config.host }}:{{ projectStore.selectedProject.ssh_config.port }}
    </p>
    <!-- Additional SSH details... -->
</div>
```

### 5. Updated Database Sidebar

Added a remote badge to the database sidebar (`Sidebar.vue`) for clear indication:

```vue
<div v-if="isRemoteConnection" class="flex justify-end mb-2">
    <RemoteBadge />
</div>
```

## Verification

- Remote badges appear in the project list on the home screen
- Connection info displays show remote badges and SSH details
- Database view header shows a remote indicator
- Database sidebar displays remote indicators
- Remote status is consistently indicated across the application

## Next Steps

After completing these tasks, proceed to [Step 7: Handle Remote File Operations](./07-remote-files.md).
