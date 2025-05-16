import { Tab } from './tab';

export interface Tabs {
	openTabs: Tab[];
	activeTabId: number | null;
	pinnedTabIds: number[];
	isLoading: boolean;
}
