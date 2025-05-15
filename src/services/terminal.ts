import { ref } from 'vue';

type TerminalStatus = 'idle' | 'running' | 'completed' | 'error';

export class TerminalService {
  private static instance: TerminalService;
  private _status = ref<TerminalStatus>('idle');
  private _lastExitCode = ref<number | null>(null);
  private _lastCommand = ref<string>('');
  private _terminal: any | null = null;

  private constructor() {}

  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  public setTerminal(terminal: any): void {
    this._terminal = terminal;
  }

  public get status() {
    return this._status.value;
  }

  public async executeCommand(command: string, projectPath?: string): Promise<boolean> {
    if (!this._terminal || !this._terminal.toggleTerminal) {
      console.error('Terminal component not properly initialized');
      return false;
    }

    if (this._status.value === 'running') {
      console.warn('Another command is currently running');
      return false;
    }

    try {
      this._status.value = 'running';
      this._lastCommand.value = command;
      this._lastExitCode.value = null;

      if (!this._terminal.isVisible) {
        this._terminal.toggleTerminal();
      }

      const exitPromise = new Promise<boolean>(resolve => {
        const onExit = (_event: any, code: number) => {
          this._lastExitCode.value = code;
          this._status.value = code === 0 ? 'completed' : 'error';
          window.ipcRenderer.removeAllListeners('terminal-exit');
          window.ipcRenderer.removeAllListeners('terminal-error');
          resolve(code === 0);
        };

        const onError = () => {
          this._status.value = 'error';
          window.ipcRenderer.removeAllListeners('terminal-exit');
          window.ipcRenderer.removeAllListeners('terminal-error');
          resolve(false);
        };

        window.ipcRenderer.on('terminal-exit', onExit);
        window.ipcRenderer.on('terminal-error', onError);
      });

      if (this._terminal.commandInput !== undefined) {
        this._terminal.commandInput = command;
        this._terminal.executeCommand();
      } else {
        if (this._terminal.writeln) {
          this._terminal.writeln(`$ ${command}`);
        }

        window.ipcRenderer.start_terminal_process(command, projectPath);
      }

      return await exitPromise;
    } catch (error) {
      console.error('Error executing command:', error);
      this._status.value = 'error';
      return false;
    }
  }
}

export default TerminalService.getInstance();
