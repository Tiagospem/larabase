import { IpcRenderer } from 'electron';

declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<{}, {}, any>;
	export default component;
}

interface ExtendedIpcRenderer extends IpcRenderer {
	[key: string]: any;
}

declare global {
	interface Window {
		ipcRenderer: ExtendedIpcRenderer;
	}
}
