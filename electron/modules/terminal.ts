import { ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

let currentProcess: ChildProcess | null = null;

export function registerTerminalHandlers() {
  ipcMain.handle('start-terminal-process', (event, command, projectPath = null) => {
    const cwd = projectPath || process.env.APP_ROOT || os.homedir();

    if (currentProcess !== null) {
      try {
        currentProcess.kill();
      } catch (e) {
        console.error('Error killing process:', e);
      }
      currentProcess = null;
    }

    try {
      const args = command.split(' ');
      const cmd = args.shift();

      if (!cmd) {
        event.sender.send('terminal-error', 'No command specified');
        return;
      }

      currentProcess = spawn(cmd, args, { cwd, shell: true });

      currentProcess.stdout.on('data', data => {
        if (event.sender) {
          event.sender.send('terminal-stdout', data.toString());
        }
      });

      currentProcess.stderr.on('data', data => {
        if (event.sender) {
          event.sender.send('terminal-stderr', data.toString());
        }
      });

      currentProcess.on('close', code => {
        if (event.sender) {
          event.sender.send('terminal-exit', code);
        }
        currentProcess = null;
      });

      currentProcess.on('error', err => {
        if (event.sender) {
          event.sender.send('terminal-error', err.message);
        }
        currentProcess = null;
      });

      return { success: true };
    } catch (error) {
      if (event.sender) {
        event.sender.send('terminal-error', error.message);
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cancel-terminal-process', () => {
    if (currentProcess) {
      try {
        currentProcess.kill('SIGINT');

        setTimeout(() => {
          if (currentProcess) {
            try {
              currentProcess.kill('SIGTERM');
            } catch (e) {
              console.error('Error terminating process:', e);
            }
          }
        }, 1000);

        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'No process running' };
  });
}
