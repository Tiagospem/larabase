<template>
	<div class="flex h-full flex-col">
		<div class="h-full flex-1 overflow-auto p-2">
			<div
				v-for="i in 12"
				:key="i"
				class="mb-1 flex w-full p-1"
			>
				<div
					class="bg-base-200 mr-4 h-6 w-10 animate-pulse rounded-sm"
				></div>
				<div
					class="bg-base-200 mr-4 h-6 flex-1 animate-pulse rounded-sm"
				></div>
				<div
					class="bg-base-200 mr-4 h-6 flex-1 animate-pulse rounded-sm"
				></div>
				<div
					class="bg-base-200 mr-4 h-6 flex-1 animate-pulse rounded-sm"
				></div>
				<div
					class="bg-base-200 mr-4 h-6 flex-1 animate-pulse rounded-sm"
				></div>
			</div>
		</div>

		<div
			class="bg-base-200 flex items-center justify-between border-t border-black/10 p-2"
		>
			<div class="flex gap-2">
				<div
					class="bg-base-100 h-6 w-20 animate-pulse rounded-sm"
				></div>
				<div
					class="bg-base-100 h-6 w-24 animate-pulse rounded-sm"
				></div>
			</div>
			<div class="flex gap-2">
				<div
					class="bg-base-100 h-8 w-8 animate-pulse rounded-full"
				></div>
				<div
					class="bg-base-100 h-8 w-8 animate-pulse rounded-full"
				></div>
				<div
					class="bg-base-100 h-8 w-8 animate-pulse rounded-full"
				></div>
			</div>
		</div>
	</div>
</template>
