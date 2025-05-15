import { ipcMain } from 'electron';
import * as bcrypt from 'bcrypt';

async function hashPasswordHandler(_: any, password: string, rounds: number = 10) {
  try {
    const saltRounds = Math.max(4, Math.min(Number(rounds) || 10, 15));

    const hash = await bcrypt.hash(password, saltRounds);
    return { success: true, hash };
  } catch (err: any) {
    console.error('Error hashing password:', err);
    return { success: false, message: err.message || 'Failed to hash password' };
  }
}

function registerPasswordHandlers() {
  ipcMain.handle('hash-password', hashPasswordHandler);
}

export { registerPasswordHandlers };
