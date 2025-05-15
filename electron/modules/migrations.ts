import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { RowDataPacket } from 'mysql2';
import { createConnection, safeEndConnection } from '../helpers/mysql';

interface MigrationRow extends RowDataPacket {
  id: number;
  migration: string;
  batch: number;
}

function registerMigrationHandlers() {
  ipcMain.handle('get-migration-status', async (_, config) => {
    try {
      if (!config.projectPath) {
        return {
          success: false,
          message: 'Project path is required',
          pendingMigrations: [],
          migrationsHistory: [],
        };
      }

      if (!config.db_config) {
        return {
          success: false,
          message: 'Database configuration is required',
          pendingMigrations: [],
          migrationsHistory: [],
        };
      }

      const artisanPath = path.join(config.projectPath, 'artisan');

      if (!fs.existsSync(artisanPath)) {
        return {
          success: false,
          message: 'Artisan file not found in project path',
          pendingMigrations: [],
          migrationsHistory: [],
        };
      }

      const statusCommand = config.usingSail
        ? ['vendor/bin/sail', 'artisan', 'migrate:status', '--no-ansi']
        : ['php', 'artisan', 'migrate:status', '--no-ansi'];

      const statusProcess = spawn(statusCommand[0], statusCommand.slice(1), {
        cwd: config.projectPath,
        shell: true,
      });

      let statusOutput = '';
      statusProcess.stdout.on('data', data => {
        statusOutput += data.toString();
      });

      let errorOutput = '';
      statusProcess.stderr.on('data', data => {
        errorOutput += data.toString();
      });

      await new Promise(resolve => {
        statusProcess.on('close', resolve);
      });

      if (errorOutput && !statusOutput) {
        console.error('Migration status command error:', errorOutput);
        return {
          success: false,
          message: 'Error running migration status command: ' + errorOutput.split('\n')[0],
          pendingMigrations: [],
          migrationsHistory: [],
        };
      }

      const pendingMigrations = [];
      const migrationsHistory = [];

      const lines = statusOutput.split('\n');

      const isTableFormat = statusOutput.includes('| Migration') && statusOutput.includes('| Ran');

      for (const line of lines) {
        if (line.includes('Pending')) {
          const match = line.match(/^\s*(\S.*?)[\s.]+Pending\s*$/);
          if (match && match[1]) {
            const migrationName = match[1].trim();
            if (!pendingMigrations.includes(migrationName)) {
              pendingMigrations.push(migrationName);
            }
          }
        }

        const ranMatch = line.match(/^\s*(\S.*?)[\s.]+\[(\d+)]\s+Ran\s*$/);
        if (ranMatch && ranMatch[1] && ranMatch[2]) {
          const migrationName = ranMatch[1].trim();
          migrationsHistory.push(migrationName);
        }

        if (isTableFormat) {
          if (line.includes('| No ')) {
            const match = line.match(/\|\s*No\s*\|\s*(.*?)\s*\|/);
            if (match && match[1]) {
              const migrationName = match[1].trim();
              if (
                migrationName &&
                !migrationName.includes('Migration') &&
                !pendingMigrations.includes(migrationName)
              ) {
                pendingMigrations.push(migrationName);
              }
            }
          }

          if (line.includes('| Yes ')) {
            const match = line.match(/\|\s*Yes\s*\|\s*(.*?)\s*\|\s*(\d+)\s*\|/);
            if (match && match[1]) {
              const migrationName = match[1].trim();

              if (migrationName && !migrationsHistory.includes(migrationName)) {
                migrationsHistory.push(migrationName);
              }
            }
          }
        }
      }

      if (migrationsHistory.length === 0) {
        let connection;
        try {
          connection = await createConnection(config.db_config);

          const [rows] = await connection.query(
            'SELECT * FROM migrations ORDER BY batch DESC, id DESC'
          );

          if (Array.isArray(rows) && rows.length > 0) {
            for (const row of rows as MigrationRow[]) {
              const migrationName = row.migration;
              if (!migrationsHistory.includes(migrationName)) {
                migrationsHistory.push(migrationName);
              }
            }
          }
        } catch (dbError) {
          console.error('Error getting migrations from database:', dbError);

          if (migrationsHistory.length === 0) {
            migrationsHistory.push('Example migration');
          }
        } finally {
          await safeEndConnection(connection);
        }
      }

      if (migrationsHistory.length === 0) {
        migrationsHistory.push('No migrations found');
      }

      migrationsHistory.sort((a, b) => {
        const timestampA = a.substring(0, 17);
        const timestampB = b.substring(0, 17);
        return timestampB.localeCompare(timestampA);
      });

      return {
        success: true,
        pendingMigrations,
        migrationsHistory,
        output: statusOutput,
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        success: false,
        message: error.message,
        pendingMigrations: [],
        migrationsHistory: [],
      };
    }
  });
}

export { registerMigrationHandlers };
