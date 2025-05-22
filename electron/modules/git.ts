import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface GitStatus {
	isGitInstalled: boolean;
	hasRepository: boolean;
	currentBranch: string;
	errorMessage?: string;
}

async function isGitInstalled(): Promise<boolean> {
	try {
		await execAsync('git --version');
		return true;
	} catch (error) {
		console.error('Git is not installed:', error);
		return false;
	}
}

async function isGitRepository(projectPath: string): Promise<boolean> {
	try {
		const gitDir = path.join(projectPath, '.git');
		return fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory();
	} catch (error) {
		console.error(
			'Error checking if directory is a git repository:',
			error
		);
		return false;
	}
}

async function getCurrentBranch(projectPath: string): Promise<string> {
	try {
		const { stdout } = await execAsync('git branch --show-current', {
			cwd: projectPath
		});
		return stdout.trim();
	} catch (error) {
		console.error('Error getting current branch:', error);
		return '';
	}
}

async function initRepository(projectPath: string): Promise<boolean> {
	try {
		await execAsync(
			'git init && git add . && git commit -m "first commit" && git checkout -b develop',
			{ cwd: projectPath }
		);
		return true;
	} catch (error) {
		console.error('Error initializing repository:', error);
		return false;
	}
}

async function getGitStatus(projectPath: string): Promise<GitStatus> {
	try {
		if (!projectPath) {
			return {
				isGitInstalled: false,
				hasRepository: false,
				currentBranch: '',
				errorMessage: 'No project path provided'
			};
		}

		const gitInstalled = await isGitInstalled();
		if (!gitInstalled) {
			return {
				isGitInstalled: false,
				hasRepository: false,
				currentBranch: '',
				errorMessage: 'Git is not installed'
			};
		}

		const hasRepo = await isGitRepository(projectPath);
		if (!hasRepo) {
			return {
				isGitInstalled: true,
				hasRepository: false,
				currentBranch: '',
				errorMessage: 'Not a git repository'
			};
		}

		const branch = await getCurrentBranch(projectPath);
		return {
			isGitInstalled: true,
			hasRepository: true,
			currentBranch: branch
		};
	} catch (error) {
		console.error('Error in getGitStatus:', error);
		return {
			isGitInstalled: false,
			hasRepository: false,
			currentBranch: '',
			errorMessage: error instanceof Error ? error.message : String(error)
		};
	}
}

export function registerGitHandlers() {
	ipcMain.handle('git-status', async (_, projectPath: string) => {
		return await getGitStatus(projectPath);
	});

	ipcMain.handle('git-init', async (_, projectPath: string) => {
		return await initRepository(projectPath);
	});
}
