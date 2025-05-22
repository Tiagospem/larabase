import { SshConnection } from '@/types/ssh-connection';

function sanitizeObject<T>(obj: T): T {
	return structuredClone(JSON.parse(JSON.stringify(obj)));
}

export async function executeRemoteCommand(
	sshConfig: SshConnection,
	command: string
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	try {
		console.log('Executing SSH command:', command);
		return await window.ipcRenderer.ssh.executeCommand(
			sanitizeObject(sshConfig),
			command
		);
	} catch (error) {
		console.error('Error executing remote command:', error);
		throw error;
	}
}

export async function executeProjectCommand(
	sshConfig: SshConnection,
	command: string
): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	const fullCommand = `cd ${sshConfig.remotePath} && ${command}`;
	return await executeRemoteCommand(sshConfig, fullCommand);
}
