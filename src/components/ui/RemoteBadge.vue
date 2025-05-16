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