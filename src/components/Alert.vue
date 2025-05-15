<template>
	<div
		v-if="message"
		class="fixed right-4 bottom-4 z-9999 max-w-sm"
	>
		<div :class="['alert', alertClass]">
			<span>{{ message }}</span>
			<button
				class="btn btn-ghost btn-sm btn-circle"
				@click="close"
			>
				✕
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { watch, computed, onUnmounted } from 'vue';

const props = defineProps({
	type: {
		type: String,
		default: 'info'
	},
	message: {
		type: String,
		default: ''
	},
	autoClose: {
		type: Boolean,
		default: true
	},
	duration: {
		type: Number,
		default: 5000
	}
});

const emit = defineEmits(['close']);

let timeoutId: ReturnType<typeof setTimeout> | null = null;

const close = () => {
	emit('close');
};

const alertClass = computed(() => {
	switch (props.type) {
		case 'success':
			return 'alert-success';
		case 'warning':
			return 'alert-warning';
		case 'error':
			return 'alert-error';
		default:
			return 'alert-info';
	}
});

watch(
	() => props.message,
	(newMessage) => {
		if (newMessage && props.autoClose) {
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				close();
			}, props.duration);
		}
	}
);

onUnmounted(() => {
	if (timeoutId) clearTimeout(timeoutId);
});
</script>
