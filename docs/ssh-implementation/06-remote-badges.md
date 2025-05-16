# Step 6: Add Remote Indication Badges

In this step, we'll enhance the UI to clearly indicate which projects or database connections are remote versus local. This will be implemented using badges and visual indicators throughout the application.

## Tasks

- [ ] Create a reusable remote badge component
- [ ] Update project list to display remote badges
- [ ] Add remote indicators to database tables view
- [ ] Add remote indicators to database connection details
- [ ] Update the project dashboard to show remote status

## Implementation Details

### 1. Create a Reusable Remote Badge Component

Create a new file `src/components/ui/RemoteBadge.vue` with the following content:

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

### 2. Update Project List Component

Update the project list item in `src/components/home/ProjectItem.vue` to use the new remote badge component:

```vue
<template>
	<!-- ... existing code ... -->
	<div class="flex justify-between items-start">
		<h2 class="card-title text-lg truncate">
			{{ project.name }}

			<!-- Connection Type and Remote Badges -->
			<div class="flex items-center ml-2">
				<div
					class="badge badge-sm"
					:class="getConnectionTypeBadgeClass(project.type)"
				>
					{{ getConnectionTypeLabel(project.type) }}
				</div>

				<!-- Use the new RemoteBadge component -->
				<RemoteBadge
					v-if="project.isRemote"
					class="ml-1"
				/>
			</div>
		</h2>
		<!-- ... rest of template ... -->
	</div>
	<!-- ... existing code ... -->
</template>

<script lang="ts" setup>
import {
	ConnectionType,
	getConnectionTypeLabel,
	getConnectionTypeColor
} from '../../types/connection-types';
import RemoteBadge from '../ui/RemoteBadge.vue';

// ... existing code ...
</script>
```

### 3. Update Database Tables View

Update the database tables view in `src/views/database/Tables.vue` to show remote indicators:

```vue
<template>
	<!-- ... existing code ... -->
	<div class="flex justify-between items-center mb-4">
		<div class="flex items-center">
			<h1 class="text-2xl font-bold">Database Tables</h1>

			<!-- Add remote badge if connection is remote -->
			<RemoteBadge
				v-if="isRemoteConnection"
				class="ml-2"
				size="lg"
			/>
		</div>
		<!-- ... rest of template ... -->
	</div>
	<!-- ... existing code ... -->
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getConnection } from '../../store/connections';
import { ConnectionType } from '../../types/connection-types';
import RemoteBadge from '../../components/ui/RemoteBadge.vue';

// ... existing code ...

// Compute whether the connection is remote
const isRemoteConnection = computed(() => {
	return currentConnection.value?.isRemote || false;
});

// ... rest of existing code ...
</script>
```

### 4. Update Database Connection Details

Update the database connection details view in `src/components/database/ConnectionInfo.vue` to show remote status:

```vue
<template>
	<div class="card bg-base-100 shadow-md">
		<div class="card-body">
			<div class="flex items-center">
				<h2 class="card-title">Connection Details</h2>

				<!-- Add remote badge -->
				<RemoteBadge
					v-if="connection?.isRemote"
					class="ml-2"
				/>
			</div>

			<!-- ... rest of template ... -->

			<!-- Add SSH Information Section for Remote Connections -->
			<div
				v-if="connection?.isRemote && connection?.ssh_config"
				class="mt-4"
			>
				<div class="divider">SSH Information</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
					<div>
						<span class="font-semibold">SSH Host:</span>
						<span class="ml-2"
							>{{ connection.ssh_config.host }}:{{
								connection.ssh_config.port
							}}</span
						>
					</div>
					<div>
						<span class="font-semibold">SSH User:</span>
						<span class="ml-2">{{
							connection.ssh_config.username
						}}</span>
					</div>
					<div>
						<span class="font-semibold">Remote Path:</span>
						<span class="ml-2">{{
							connection.ssh_config.remotePath
						}}</span>
					</div>
					<div>
						<span class="font-semibold">Remote DB Type:</span>
						<span class="ml-2">{{
							connection.ssh_config.remoteDbType
						}}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue';
import type { ProjectConnection } from '../../types/project';
import RemoteBadge from '../ui/RemoteBadge.vue';

defineProps({
	connection: {
		type: Object as PropType<ProjectConnection>,
		required: true
	}
});
</script>
```

### 5. Update Project Dashboard

Update the project dashboard in `src/views/project/Dashboard.vue` to display remote status:

```vue
<template>
	<div class="container mx-auto p-4">
		<div class="flex justify-between items-center mb-6">
			<div class="flex items-center">
				<h1 class="text-2xl font-bold">{{ project?.name }}</h1>

				<!-- Add connection type badge -->
				<div class="ml-3 flex items-center space-x-2">
					<div
						v-if="project?.type"
						class="badge"
						:class="getConnectionTypeBadgeClass(project.type)"
					>
						{{ getConnectionTypeLabel(project.type) }}
					</div>

					<!-- Add remote badge -->
					<RemoteBadge v-if="project?.isRemote" />
				</div>
			</div>

			<!-- ... rest of template ... -->
		</div>

		<!-- ... rest of template ... -->

		<!-- Add Remote Connection Info Card -->
		<div
			v-if="project?.isRemote && project?.ssh_config"
			class="card bg-base-100 shadow-md mb-6"
		>
			<div class="card-body">
				<h2 class="card-title">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-6 h-6 mr-2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z"
						/>
					</svg>
					Remote Connection
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<p>
							<span class="font-semibold">SSH Host:</span>
							{{ project.ssh_config.host }}:{{
								project.ssh_config.port
							}}
						</p>
						<p>
							<span class="font-semibold">SSH User:</span>
							{{ project.ssh_config.username }}
						</p>
						<p>
							<span class="font-semibold">Project Path:</span>
							{{ project.ssh_config.remotePath }}
						</p>
					</div>
					<div>
						<p>
							<span class="font-semibold">Remote DB Type:</span>
							{{ project.ssh_config.remoteDbType }}
						</p>
						<p>
							<span class="font-semibold">Remote DB Host:</span>
							{{ project.ssh_config.remoteDbConfig.host }}:{{
								project.ssh_config.remoteDbConfig.port
							}}
						</p>
						<p>
							<span class="font-semibold">Remote DB Name:</span>
							{{ project.ssh_config.remoteDbConfig.database }}
						</p>
					</div>
				</div>
				<div class="card-actions justify-end mt-4">
					<button
						@click="testRemoteConnection"
						class="btn btn-primary btn-sm"
					>
						Test Connection
					</button>
					<button
						@click="executeRemoteCommand"
						class="btn btn-secondary btn-sm"
					>
						Run Artisan Command
					</button>
				</div>
			</div>
		</div>

		<!-- ... rest of template ... -->
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getConnection } from '../../store/connections';
import {
	ConnectionType,
	getConnectionTypeLabel,
	getConnectionTypeColor
} from '../../types/connection-types';
import RemoteBadge from '../../components/ui/RemoteBadge.vue';

// ... existing code ...

// Badge helper
function getConnectionTypeBadgeClass(type: ConnectionType): string {
	return `${getConnectionTypeColor(type)} text-white`;
}

// Remote connection functions
async function testRemoteConnection() {
	if (!project.value?.ssh_config) return;

	try {
		const result = await window.electronAPI.ssh.testConnection(
			project.value.ssh_config
		);
		// Show result in a toast or alert
	} catch (error) {
		// Handle error
		console.error('Error testing connection:', error);
	}
}

async function executeRemoteCommand() {
	if (!project.value?.ssh_config) return;

	// This could open a modal to input and execute a command
	// Implementation would depend on your UI framework and approach

	// Example implementation using a simple prompt:
	const command = prompt(
		'Enter artisan command to execute (without php artisan):'
	);
	if (!command) return;

	try {
		const fullCommand = `cd ${project.value.ssh_config.remotePath} && php artisan ${command}`;
		const result = await window.electronAPI.ssh.executeCommand(
			project.value.ssh_config,
			fullCommand
		);
		// Show result in a modal or alert
		alert(
			`Command output:\n${result.stdout || 'No output'}\n\nErrors:\n${result.stderr || 'No errors'}`
		);
	} catch (error) {
		// Handle error
		console.error('Error executing command:', error);
	}
}

// ... rest of existing code ...
</script>
```

### 6. Update Navigation Component

Update the application sidebar or navigation component to indicate remote connections:

```vue
<template>
	<!-- ... existing code ... -->
	<ul class="menu bg-base-200 w-56 p-2">
		<!-- ... existing nav items ... -->

		<!-- Update project links to show remote badge -->
		<template
			v-for="project in projects"
			:key="project.id"
		>
			<li>
				<router-link
					:to="`/project/${project.id}`"
					class="flex items-center"
				>
					<span class="flex-1">{{ project.name }}</span>
					<RemoteBadge v-if="project.isRemote" />
				</router-link>
			</li>
		</template>
	</ul>
	<!-- ... existing code ... -->
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { listConnections } from '../../store/connections';
import type { ProjectConnection } from '../../types/project';
import RemoteBadge from '../ui/RemoteBadge.vue';

// ... existing code ...
</script>
```

## Verification

- Ensure the remote badge component is created and works correctly
- Verify that remote badges appear on all relevant screens
- Confirm that the project list shows remote badges correctly
- Check that the database views properly indicate remote connections
- Test that all remote connection details are displayed correctly

## Next Steps

After completing these tasks, proceed to [Step 7: Handle Remote File Operations](./07-remote-files.md).
