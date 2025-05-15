import { useSqlScratchesStore } from '@/store/sqlScratches';
import type { SqlScratch } from '@/store/sqlScratches';

export interface SaveScratchOptions {
	content: string;
	projectId: string;
	name?: string;
}

export class SqlScratchService {
	private static instance: SqlScratchService;
	private scratchesStore = useSqlScratchesStore();

	private constructor() {}

	public static getInstance(): SqlScratchService {
		if (!SqlScratchService.instance) {
			SqlScratchService.instance = new SqlScratchService();
		}

		return SqlScratchService.instance;
	}

	public loadScratches(projectId: string): void {
		this.scratchesStore.loadScratches(projectId);
	}

	public toggleSidePanel(): void {
		this.scratchesStore.toggleSidePanel();
	}

	public get isOpen(): boolean {
		return this.scratchesStore.isOpen;
	}

	public set isOpen(value: boolean) {
		this.scratchesStore.isOpen = value;
	}

	public get activeScratchId(): string | null {
		return this.scratchesStore.activeScratchId;
	}

	public getActiveScratch(): SqlScratch | null {
		const activeScratch = this.scratchesStore.getActiveScratch();
		return activeScratch || null;
	}

	public setActiveScratch(id: string): void {
		this.scratchesStore.setActiveScratch(id);
	}

	public saveScratch({ content, projectId, name }: SaveScratchOptions): void {
		if (!content.trim()) return;

		let scratchName = name;

		if (!scratchName) {
			const firstLine = content
				.split('\n')[0]
				.replace(/^--\s*/, '')
				.trim();
			if (firstLine) {
				scratchName = firstLine;
			} else {
				const timestamp = new Date()
					.toLocaleString()
					.replace(/[/:]/g, '-');
				scratchName = `SQL Scratch ${timestamp}`;
			}
		}

		this.scratchesStore.addScratch(scratchName, content, projectId);

		this.scratchesStore.isOpen = true;
	}

	public updateActiveScratchContent(
		content: string,
		projectId: string
	): boolean {
		return this.scratchesStore.updateActiveScratchContent(
			content,
			projectId
		);
	}

	public getScratchById(id: string) {
		return this.scratchesStore.getScratchById(id);
	}

	public updateScratch(
		id: string,
		data: { name?: string; content?: string },
		projectId: string
	) {
		return this.scratchesStore.updateScratch(id, data, projectId);
	}

	public deleteScratch(id: string, projectId: string) {
		return this.scratchesStore.deleteScratch(id, projectId);
	}

	public get scratches() {
		return this.scratchesStore.scratches;
	}
}
