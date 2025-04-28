const { ipcMain, dialog, shell } = require("electron");
const { getMainWindow } = require("../modules/window");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");
const pluralize = require("pluralize");
const docker = require("./docker");
const mysql = require("mysql2/promise");

function extractEnvValue(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  if (match && match[1]) {
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function execCommand(cmd, { timeout = 2000, windowsHide = true, stdio = "pipe" } = {}) {
  try {
    return execSync(cmd, {
      timeout,
      shell: true,
      windowsHide,
      stdio
    }).toString();
  } catch {
    return "";
  }
}

async function detectDockerMysql(port) {
  return await docker.detectDockerMysql(port);
}

function registerProjectHandlers() {
  ipcMain.handle("select-directory", async () => {
    const mainWindow = getMainWindow();

    try {
      return await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"]
      });
    } catch (error) {
      console.error("Error selecting directory:", error);
      throw error;
    }
  });

  ipcMain.handle("find-table-migrations", async (_, config) => {
    try {
      if (!config.projectPath || !config.tableName) {
        return {
          success: false,
          message: "Missing project path or table name",
          migrations: []
        };
      }

      const tableName = config.tableName;
      const migrationsPath = path.join(config.projectPath, "database", "migrations");

      if (!fs.existsSync(migrationsPath)) {
        return {
          success: false,
          message: "Migrations directory not found",
          migrations: []
        };
      }

      const migrationFiles = fs.readdirSync(migrationsPath).filter((file) => file.endsWith(".php"));

      const relevantMigrations = [];

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsPath, file);
        const content = fs.readFileSync(filePath, "utf8");

        const tablePattern = new RegExp(`['"](${tableName})['"]|Schema::create\\(['"]${tableName}['"]|Schema::table\\(['"]${tableName}['"]`, "i");

        if (tablePattern.test(content)) {
          const nameParts = file.split("_");
          const timestamp = nameParts[0];

          const year = timestamp.substring(0, 4);
          const month = timestamp.substring(4, 6);
          const day = timestamp.substring(6, 8);

          const dateString = `${year}-${month}-${day}`;

          const date = new Date(dateString);

          let migrationName = file.replace(/^\d+_/, "").replace(".php", "");

          migrationName = migrationName
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          const actions = [];

          if (content.includes(`Schema::create('${tableName}'`) || content.includes(`Schema::create("${tableName}"`)) {
            actions.push({
              type: "CREATE",
              description: `Created ${tableName} table`
            });
          } else if (content.includes(`Schema::table('${tableName}'`) || content.includes(`Schema::table("${tableName}"`)) {
            actions.push({
              type: "ALTER",
              description: `Modified ${tableName} table`
            });

            if (content.includes("->add") || content.match(/\$table->\w+\(/g)) {
              actions.push({
                type: "ADD",
                description: "Added columns"
              });
            }

            if (content.includes("->drop") || content.includes("dropColumn")) {
              actions.push({
                type: "DROP",
                description: "Removed columns"
              });
            }

            if (content.includes("foreign") || content.includes("references")) {
              actions.push({
                type: "FOREIGN KEY",
                description: "Modified foreign keys"
              });
            }
          }

          if (content.includes(`Schema::drop`) || content.includes("dropIfExists")) {
            actions.push({
              type: "DROP",
              description: `Dropped table`
            });
          }

          const status = "APPLIED";

          relevantMigrations.push({
            id: file,
            name: file,
            displayName: migrationName,
            status: status,
            created_at: date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            }),
            table: tableName,
            actions: actions,
            code: content,
            path: filePath
          });
        }
      }

      relevantMigrations.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      return {
        success: true,
        migrations: relevantMigrations
      };
    } catch (error) {
      console.error("Error finding table migrations:", error);
      return {
        success: false,
        message: error.message || "Failed to find table migrations",
        migrations: []
      };
    }
  });

  ipcMain.handle("find-models-for-tables", async (_, config = {}) => {
    try {
      const { projectPath } = config;
      if (!projectPath) {
        return {
          success: false,
          message: "Missing project path",
          models: {}
        };
      }

      const dirs = [path.join(projectPath, "app", "Models"), path.join(projectPath, "app")];

      /**
       * Recursively read .php model files and collect class metadata.
       */
      const collectModels = () => {
        const models = [];

        const traverse = (dir) => {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, {
            withFileTypes: true
          })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              traverse(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".php")) {
              try {
                const content = fs.readFileSync(fullPath, "utf8");
                const isModel = [
                  "extends Model",
                  "Illuminate\\Database\\Eloquent\\Model",
                  "extends Authenticatable",
                  "Illuminate\\Foundation\\Auth\\User",
                  "Illuminate\\Contracts\\Auth\\Authenticatable"
                ].some((keyword) => content.includes(keyword));
                if (!isModel) continue;

                const nsMatch = content.match(/namespace\s+([^;]+);/);
                const classMatch = content.match(/class\s+(\w+)/);
                if (!classMatch) continue;

                const name = classMatch[1];
                const namespace = nsMatch?.[1] || null;
                const fullName = namespace ? `${namespace}\\${name}` : name;
                const relPath = path.relative(projectPath, fullPath);

                models.push({
                  name,
                  namespace,
                  fullName,
                  path: fullPath,
                  relativePath: relPath,
                  content
                });
              } catch (err) {
                console.error(`Error parsing model file ${fullPath}:`, err);
              }
            }
          }
        };

        dirs.forEach(traverse);
        return models;
      };

      const models = collectModels();
      const mapping = {};

      /**
       * Determine table names for a model based on content or conventions.
       */
      const getTableNames = (model) => {
        const names = new Set();
        // explicit protected $table
        const match = model.content.match(/protected\s+\$table\s*=\s*['"](.*?)['"]/);
        if (match) names.add(match[1]);

        // convention: snake_case + plural/singular
        const snake = model.name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
        names.add(pluralize.plural(snake));
        names.add(pluralize.singular(snake));

        // any additional table assignments found in code
        const extra = [...model.content.matchAll(/\$table\s*=\s*['"]([^'"]+)['"]/g)];
        extra.forEach((m) => names.add(m[1]));

        return Array.from(names);
      };

      // Build final map: tableName => modelInfo (excluding content)
      models.forEach((model) => {
        const info = {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          path: model.path,
          relativePath: model.relativePath
        };
        getTableNames(model).forEach((table) => {
          if (!mapping[table]) {
            mapping[table] = info;
          }
        });
      });

      return { success: true, models: mapping };
    } catch (error) {
      console.error("Error finding models for tables:", error);
      return { success: false, message: error.message, models: {} };
    }
  });

  ipcMain.handle("read-env-file", async (_, projectPath) => {
    try {
      const envPath = path.join(projectPath, ".env");

      if (!fs.existsSync(envPath)) {
        console.error(".env file not found at:", envPath);
        return null;
      }

      const envContent = fs.readFileSync(envPath, "utf8");
      const envConfig = {};

      envContent.split("\n").forEach((line) => {
        if (line.startsWith("#") || line.trim() === "") {
          return;
        }

        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";

          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }

          envConfig[key] = value;
        }
      });

      if (envConfig.DB_PORT) {
        envConfig.dockerInfo = await detectDockerMysql(envConfig.DB_PORT);
      }

      return envConfig;
    } catch (error) {
      console.error("Error reading .env file:", error);
      return null;
    }
  });

  ipcMain.handle("read-env-file-raw", async (_, projectPath) => {
    try {
      const envPath = path.join(projectPath, ".env");

      if (!fs.existsSync(envPath)) {
        console.error(".env file not found at:", envPath);
        return { success: false, message: ".env file not found" };
      }

      const envContent = fs.readFileSync(envPath, "utf8");

      return {
        success: true,
        content: envContent
      };
    } catch (error) {
      console.error("Error reading .env file:", error);
      return {
        success: false,
        message: error.message || "Failed to read .env file"
      };
    }
  });

  ipcMain.handle("save-env-file", async (_, projectPath, content) => {
    try {
      const envPath = path.join(projectPath, ".env");

      if (fs.existsSync(envPath)) {
        const backupPath = path.join(projectPath, ".env.backup");
        fs.copyFileSync(envPath, backupPath);
      }

      fs.writeFileSync(envPath, content, "utf8");

      return {
        success: true,
        message: ".env file saved successfully"
      };
    } catch (error) {
      console.error("Error saving .env file:", error);
      return {
        success: false,
        message: error.message || "Failed to save .env file"
      };
    }
  });

  ipcMain.handle("validate-laravel-project", async (_, projectPath) => {
    try {
      const hasEnv = fs.existsSync(path.join(projectPath, ".env"));
      const hasArtisan = fs.existsSync(path.join(projectPath, "artisan"));
      const hasComposerJson = fs.existsSync(path.join(projectPath, "composer.json"));

      return hasEnv && hasArtisan && hasComposerJson;
    } catch (error) {
      console.error("Error validating Laravel project:", error);
      return false;
    }
  });

  ipcMain.handle("compare-project-database", async (_, { projectPath, connectionDatabase }) => {
    try {
      if (!projectPath || !connectionDatabase) {
        return {
          success: false,
          message: "Missing project path or connection database",
          isMatch: false
        };
      }

      const envPath = path.join(projectPath, ".env");

      if (!fs.existsSync(envPath)) {
        return {
          success: false,
          message: ".env file not found",
          isMatch: false
        };
      }

      const envContent = fs.readFileSync(envPath, "utf8");
      const projectDatabase = extractEnvValue(envContent, "DB_DATABASE");

      if (!projectDatabase) {
        return {
          success: false,
          message: "DB_DATABASE not found in .env file",
          isMatch: false
        };
      }

      return {
        success: true,
        isMatch: projectDatabase === connectionDatabase,
        projectDatabase,
        connectionDatabase
      };
    } catch (error) {
      console.error("Error comparing project database:", error);
      return {
        success: false,
        message: error.message || "Failed to compare project database",
        isMatch: false
      };
    }
  });

  ipcMain.handle("find-laravel-commands", async (_, projectPath) => {
    try {
      if (!projectPath) {
        return {
          success: false,
          message: "Missing project path",
          commands: []
        };
      }

      const commands = [];

      const commandDirs = [path.join(projectPath, "app", "Console", "Commands"), path.join(projectPath, "app", "Commands")];

      const processCommandFiles = (dir) => {
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            processCommandFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".php")) {
            try {
              const content = fs.readFileSync(fullPath, "utf8");
              const classNameMatch = content.match(/class\s+(\w+)/);
              const namespaceMatch = content.match(/namespace\s+([\w\\]+)/);
              const signatureMatch = content.match(/protected\s+\$signature\s*=\s*['"](.+?)['"]/);
              const descriptionMatch = content.match(/protected\s+\$description\s*=\s*['"](.+?)['"]/);

              if (classNameMatch && signatureMatch) {
                const className = classNameMatch[1];
                const signature = signatureMatch[1];
                const description = descriptionMatch ? descriptionMatch[1] : "";

                const namespace = namespaceMatch ? namespaceMatch[1] : "";

                const relativePath = fullPath.replace(projectPath, "").replace(/^[\/\\]/, "");

                const commandName = signature.split(" ")[0];

                if (!commands.some((cmd) => cmd.name === commandName)) {
                  commands.push({
                    name: commandName,
                    signature: signature,
                    description: description,
                    className: className,
                    namespace: namespace,
                    path: fullPath,
                    relativePath: relativePath,
                    isBuiltIn: false
                  });
                }
              }
            } catch (err) {
              console.error(`Error processing command file ${fullPath}:`, err);
            }
          }
        }
      };

      for (const dir of commandDirs) {
        processCommandFiles(dir);
      }

      const possibleCommandLocations = [path.join(projectPath, "app"), path.join(projectPath, "packages")];

      for (const location of possibleCommandLocations) {
        if (fs.existsSync(location)) {
          const findCommandsInDir = (dir, depth = 0) => {
            if (depth > 5) return;

            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });

              for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== "Commands" && entry.name !== "Console") {
                  if (!commandDirs.includes(path.join(dir, entry.name))) {
                    findCommandsInDir(path.join(dir, entry.name), depth + 1);
                  }
                } else if (entry.isFile() && entry.name.endsWith(".php")) {
                  const fullPath = path.join(dir, entry.name);

                  try {
                    const content = fs.readFileSync(fullPath, "utf8");

                    if (content.includes("$signature") && (content.includes("extends Command") || content.includes("Illuminate\\Console\\Command"))) {
                      const classNameMatch = content.match(/class\s+(\w+)/);
                      const namespaceMatch = content.match(/namespace\s+([\w\\]+)/);
                      const signatureMatch = content.match(/protected\s+\$signature\s*=\s*['"](.+?)['"]/);
                      const descriptionMatch = content.match(/protected\s+\$description\s*=\s*['"](.+?)['"]/);

                      if (classNameMatch && signatureMatch) {
                        const className = classNameMatch[1];
                        const signature = signatureMatch[1];
                        const description = descriptionMatch ? descriptionMatch[1] : "";
                        const namespace = namespaceMatch ? namespaceMatch[1] : "";
                        const relativePath = fullPath.replace(projectPath, "").replace(/^[\/\\]/, "");
                        const commandName = signature.split(" ")[0];

                        if (!commands.some((cmd) => cmd.name === commandName)) {
                          commands.push({
                            name: commandName,
                            signature: signature,
                            description: description,
                            className: className,
                            namespace: namespace,
                            path: fullPath,
                            relativePath: relativePath,
                            isBuiltIn: false
                          });
                        }
                      }
                    }
                  } catch (err) {
                    console.error(`Error checking file ${fullPath}:`, err);
                  }
                }
              }
            } catch (err) {
              console.error(`Error reading directory ${dir}:`, err);
            }
          };

          findCommandsInDir(location);
        }
      }

      try {
        const useSail = fs.existsSync(path.join(projectPath, "docker-compose.yml")) && fs.existsSync(path.join(projectPath, "vendor", "laravel", "sail"));

        const cmdPrefix = useSail ? "sail " : "";
        const artisanListCmd = `cd "${projectPath}" && ${cmdPrefix}php artisan list --format=json`;

        const artisanListOutput = execCommand(artisanListCmd, { timeout: 10000 });

        if (artisanListOutput) {
          try {
            const jsonStart = artisanListOutput.indexOf("{");
            const jsonEnd = artisanListOutput.lastIndexOf("}");

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = artisanListOutput.substring(jsonStart, jsonEnd + 1);
              const parsed = JSON.parse(jsonStr);

              if (parsed.commands) {
                for (const cmdName in parsed.commands) {
                  const cmd = parsed.commands[cmdName];

                  if (!commands.some((c) => c.name === cmdName)) {
                    commands.push({
                      name: cmdName,
                      signature: cmd.definition || cmdName,
                      description: cmd.description || "",
                      className: null,
                      path: null,
                      relativePath: null,
                      isBuiltIn: true
                    });
                  }
                }
              }
            }
          } catch (jsonErr) {
            console.error("Error parsing artisan list JSON:", jsonErr);
          }
        }
      } catch (artisanErr) {
        console.error("Error running artisan list command:", artisanErr);
      }

      commands.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        commands: commands
      };
    } catch (error) {
      console.error("Error finding Laravel commands:", error);
      return {
        success: false,
        message: error.message || "Error finding Laravel commands",
        commands: []
      };
    }
  });

  ipcMain.handle("clear-all-project-logs", async (_, config) => {
    try {
      if (!config || !config.projectPath) {
        return { success: false, message: "No project path provided" };
      }

      const logsPath = path.join(config.projectPath, "storage", "logs");

      if (!fs.existsSync(logsPath)) {
        return { success: false, message: "Logs directory not found" };
      }

      const logFiles = fs.readdirSync(logsPath).filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        return { success: true, message: "No log files found" };
      }

      let clearedCount = 0;

      for (const logFile of logFiles) {
        try {
          const logFilePath = path.join(logsPath, logFile);

          fs.writeFileSync(logFilePath, "", "utf8");
          clearedCount++;
        } catch (fileError) {
          console.error(`Error clearing log file ${logFile}:`, fileError);
        }
      }

      return {
        success: true,
        message: `Cleared ${clearedCount} log files`,
        clearedFiles: clearedCount
      };
    } catch (error) {
      console.error("Error clearing project logs:", error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("open-file", async (_, filePath) => {
    try {
      const editors = [
        {
          name: "PHPStorm",
          paths: [
            "/Applications/PhpStorm.app/Contents/MacOS/phpstorm",
            "/usr/local/bin/phpstorm",
            "C:\\Program Files\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe",
            "C:\\Program Files (x86)\\JetBrains\\PhpStorm\\bin\\phpstorm.exe"
          ]
        },
        {
          name: "VSCode",
          paths: [
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
            "/usr/bin/code",
            "/usr/local/bin/code",
            "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
            "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
            "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd"
          ]
        },
        {
          name: "Sublime Text",
          paths: [
            "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl",
            "/usr/local/bin/subl",
            "C:\\Program Files\\Sublime Text\\subl.exe",
            "C:\\Program Files (x86)\\Sublime Text\\subl.exe"
          ]
        }
      ];

      for (const editor of editors) {
        for (const editorPath of editor.paths) {
          try {
            if (fs.existsSync(editorPath)) {
              const child = require("child_process").spawn(editorPath, [filePath], {
                detached: true,
                stdio: "ignore"
              });
              child.unref();
              return { success: true, editor: editor.name };
            }
          } catch (e) {
            console.error(`Error checking editor path ${editorPath}:`, e);
          }
        }
      }

      await shell.openPath(filePath);

      return { success: true, editor: "default" };
    } catch (error) {
      console.error("Failed to open file:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-project-logs", async (_, config) => {
    try {
      if (!config || !config.projectPath) {
        return [];
      }

      const logsPath = path.join(config.projectPath, "storage", "logs");

      if (!fs.existsSync(logsPath)) {
        console.error("Logs directory not found at:", logsPath);
        return [];
      }

      const allFiles = fs.readdirSync(logsPath);

      const logFiles = allFiles.filter((file) => file.endsWith(".log"));

      if (logFiles.length === 0) {
        return [];
      }

      let logFilePath;
      let logFileName;

      if (logFiles.includes("laravel.log")) {
        logFileName = "laravel.log";
        logFilePath = path.join(logsPath, logFileName);
      } else {
        const dailyLogPattern = /laravel-\d{4}-\d{2}-\d{2}\.log/;
        const dailyLogFiles = logFiles.filter((file) => dailyLogPattern.test(file));

        if (dailyLogFiles.length > 0) {
          dailyLogFiles.sort().reverse();
          logFileName = dailyLogFiles[0];
          logFilePath = path.join(logsPath, logFileName);
        } else {
          logFileName = logFiles[0];
          logFilePath = path.join(logsPath, logFileName);
        }
      }

      const logContent = fs.readFileSync(logFilePath, "utf8");

      if (!logContent || logContent.trim() === "") {
        return [];
      }

      const lines = logContent.split("\n");

      const logEntries = [];
      let currentEntry = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}\.?\d*(?:[\+-]\d{4})?)\]/);

        if (timestampMatch) {
          if (currentEntry) {
            logEntries.push(currentEntry);
          }

          let type = "info";
          if (line.toLowerCase().includes("error") || line.toLowerCase().includes("exception")) {
            type = "error";
          } else if (line.toLowerCase().includes("warning")) {
            type = "warning";
          } else if (line.toLowerCase().includes("debug")) {
            type = "debug";
          } else if (line.toLowerCase().includes("info")) {
            type = "info";
          }

          currentEntry = {
            id: `log_${Date.now()}_${i}`,
            timestamp: new Date(timestampMatch[1]).getTime(),
            type: type.toLowerCase(),
            message: line,
            stack: null,
            file: logFileName
          };
        } else if (currentEntry) {
          if (line.includes("Stack trace:")) {
            currentEntry.stack = "";
          } else if (currentEntry.stack !== null) {
            currentEntry.stack += line + "\n";
          } else {
            currentEntry.message += "\n" + line;
          }
        }
      }

      if (currentEntry) {
        logEntries.push(currentEntry);
      }

      if (logEntries.length === 0) {
        const sampleContent = logContent.substring(0, Math.min(500, logContent.length));

        return [
          {
            id: `log_raw_${Date.now()}`,
            timestamp: Date.now(),
            type: "info",
            message: "Raw log content sample:\n\n" + sampleContent,
            stack: null,
            file: logFileName
          }
        ];
      }

      return logEntries;
    } catch (error) {
      console.error("Error reading project logs:", error);
      return [
        {
          id: `log_error_${Date.now()}`,
          timestamp: Date.now(),
          type: "error",
          message: `Error reading logs: ${error.message}`,
          stack: error.stack,
          file: "error"
        }
      ];
    }
  });

  ipcMain.handle("get-migration-status", async (_, config) => {
    try {
      if (!config.projectPath) {
        return {
          success: false,
          message: "Project path is required",
          pendingMigrations: [],
          batches: []
        };
      }

      const artisanPath = path.join(config.projectPath, "artisan");

      if (!fs.existsSync(artisanPath)) {
        return {
          success: false,
          message: "Artisan file not found in project path",
          pendingMigrations: [],
          batches: []
        };
      }

      const hasSail = fs.existsSync(path.join(config.projectPath, "vendor/bin/sail"));
      const useSail = config.useSail && hasSail;

      const statusCommand = useSail ? ["vendor/bin/sail", "artisan", "migrate:status", "--no-ansi"] : ["php", "artisan", "migrate:status", "--no-ansi"];

      const statusProcess = spawn(statusCommand[0], statusCommand.slice(1), {
        cwd: config.projectPath,
        shell: true
      });

      let statusOutput = "";
      statusProcess.stdout.on("data", (data) => {
        statusOutput += data.toString();
      });

      let errorOutput = "";
      statusProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      await new Promise((resolve) => {
        statusProcess.on("close", resolve);
      });

      if (errorOutput && !statusOutput) {
        console.error("Migration status command error:", errorOutput);
        return {
          success: false,
          message: "Error running migration status command: " + errorOutput.split("\n")[0],
          pendingMigrations: [],
          batches: []
        };
      }

      const pendingMigrations = [];
      const batches = new Map();

      const lines = statusOutput.split("\n");

      for (const line of lines) {
        if (line.includes("Pending")) {
          const match = line.match(/^\s*([^\s].*?)\s+\.+\s+Pending\s*$/);
          if (match && match[1]) {
            const migrationName = match[1].trim();
            pendingMigrations.push(migrationName);
          }
        }

        const ranMatch = line.match(/^\s*([^\s].*?)\s+\.+\s+\[(\d+)\]\s+Ran\s*$/);
        if (ranMatch && ranMatch[1] && ranMatch[2]) {
          const migrationName = ranMatch[1].trim();
          const batchNumber = parseInt(ranMatch[2], 10);

          if (!batches.has(batchNumber)) {
            batches.set(batchNumber, []);
          }
          batches.get(batchNumber).push(migrationName);
        }

        if (line.includes("| No ")) {
          const match = line.match(/\|\s*No\s*\|\s*(.*?)\s*\|/);
          if (match && match[1]) {
            const migrationName = match[1].trim();
            if (migrationName && !migrationName.includes("Migration") && !pendingMigrations.includes(migrationName)) {
              pendingMigrations.push(migrationName);
            }
          }
        }

        if (line.includes("| Yes ")) {
          const match = line.match(/\|\s*Yes\s*\|\s*(.*?)\s*\|\s*(\d+)\s*\|/);
          if (match && match[1] && match[2]) {
            const migrationName = match[1].trim();
            const batchNumber = parseInt(match[2].trim(), 10);

            if (migrationName && !isNaN(batchNumber)) {
              if (!batches.has(batchNumber)) {
                batches.set(batchNumber, []);
              }
              if (!batches.get(batchNumber).includes(migrationName)) {
                batches.get(batchNumber).push(migrationName);
              }
            }
          }
        }
      }

      if (batches.size === 0) {
        try {
          const envFilePath = path.join(config.projectPath, ".env");
          const envContent = fs.readFileSync(envFilePath, "utf8");
          const dbConfig = {
            host: extractEnvValue(envContent, "DB_HOST") || "localhost",
            port: parseInt(extractEnvValue(envContent, "DB_PORT") || "3306", 10),
            user: extractEnvValue(envContent, "DB_USERNAME") || "root",
            password: extractEnvValue(envContent, "DB_PASSWORD") || "",
            database: extractEnvValue(envContent, "DB_DATABASE") || "laravel"
          };

          const connection = await mysql.createConnection(dbConfig);

          const [rows] = await connection.query("SELECT * FROM migrations ORDER BY batch DESC, id DESC");

          if (rows && rows.length > 0) {
            for (const row of rows) {
              const batchNumber = row.batch;
              const migrationName = row.migration;

              if (!batches.has(batchNumber)) {
                batches.set(batchNumber, []);
              }

              batches.get(batchNumber).push(migrationName);
            }
          }

          await connection.end();
        } catch (dbError) {
          console.error("Error getting migrations from database:", dbError);

          if (batches.size === 0) {
            batches.set(1, ["Example migration in batch 1"]);
          }
        }
      }

      if (batches.size === 0) {
        batches.set(1, ["No migrations found in batch 1"]);
      }

      const batchesArray = Array.from(batches.entries()).map(([batchNumber, migrations]) => {
        const sortedMigrations = [...migrations].sort((a, b) => {
          const timestampA = a.substring(0, 17);
          const timestampB = b.substring(0, 17);

          return timestampB.localeCompare(timestampA);
        });

        return {
          batch: batchNumber,
          migrations: sortedMigrations
        };
      });

      batchesArray.sort((a, b) => b.batch - a.batch);

      return {
        success: true,
        pendingMigrations,
        batches: batchesArray,
        hasSail,
        output: statusOutput
      };
    } catch (error) {
      console.error("Error getting migration status:", error);
      return {
        success: false,
        message: error.message,
        pendingMigrations: [],
        batches: []
      };
    }
  });

  ipcMain.handle("read-model-file", async (event, filePath) => {
    try {
      if (!filePath) {
        return {
          success: false,
          message: "Missing file path",
          content: null
        };
      }

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: "File not found",
          content: null
        };
      }

      const content = fs.readFileSync(filePath, "utf8");

      return {
        success: true,
        content: content
      };
    } catch (error) {
      console.error("Error reading model file:", error);
      return {
        success: false,
        message: error.message,
        content: null
      };
    }
  });

  ipcMain.handle("update-env-database", async (event, projectPath, database) => {
    try {
      if (!projectPath || !database) {
        return {
          success: false,
          message: "Missing project path or database name"
        };
      }

      const envPath = path.join(projectPath, ".env");
      if (!fs.existsSync(envPath)) {
        return {
          success: false,
          message: ".env file not found in project"
        };
      }

      let envContent = fs.readFileSync(envPath, "utf8");

      const lines = envContent.split("\n");
      let dbLineFound = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith("#")) {
          continue;
        }

        if (line.trim().startsWith("DB_DATABASE=")) {
          lines[i] = `DB_DATABASE=${database}`;
          dbLineFound = true;
          break;
        }
      }

      if (!dbLineFound) {
        lines.push(`DB_DATABASE=${database}`);
      }

      const updatedContent = lines.join("\n");

      fs.writeFileSync(envPath, updatedContent);

      return {
        success: true,
        message: `Updated database to ${database} in .env file`
      };
    } catch (error) {
      console.error("Error updating .env database:", error);
      return {
        success: false,
        message: error.message || "Failed to update database in .env file"
      };
    }
  });

  ipcMain.handle("list-files", async (_, dirPath) => {
    try {
      if (!dirPath) {
        return {
          success: false,
          message: "Missing directory path",
          files: []
        };
      }

      if (!fs.existsSync(dirPath)) {
        return {
          success: false,
          message: "Directory not found",
          files: []
        };
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }));

      return {
        success: true,
        files: files
      };
    } catch (error) {
      console.error("Error listing files:", error);
      return {
        success: false,
        message: error.message,
        files: []
      };
    }
  });

  ipcMain.handle("run-artisan-command", async (event, config) => {
    try {
      if (!config.projectPath) {
        return {
          success: false,
          message: "Project path is required",
          output: ""
        };
      }

      if (!config.command) {
        return {
          success: false,
          message: "Command is required",
          output: ""
        };
      }

      const artisanPath = path.join(config.projectPath, "artisan");
      if (!fs.existsSync(artisanPath)) {
        return {
          success: false,
          message: "Artisan file not found in project path",
          output: ""
        };
      }

      const commandId = Date.now().toString();

      let commandArgs;
      const hasSail = fs.existsSync(path.join(config.projectPath, "vendor/bin/sail"));

      if (config.useSail && hasSail) {
        commandArgs = ["vendor/bin/sail", "artisan", ...config.command.split(" ")];
      } else {
        commandArgs = ["php", "artisan", ...config.command.split(" ")];
      }

      const process = spawn(commandArgs[0], commandArgs.slice(1), {
        cwd: config.projectPath,
        shell: true
      });

      const response = {
        success: true,
        commandId: commandId,
        command: commandArgs.join(" "),
        output: "",
        isComplete: false
      };

      const outputChannel = `command-output-${commandId}`;

      process.stdout.on("data", (data) => {
        const output = data.toString();
        if (event.sender) {
          event.sender.send(outputChannel, {
            commandId,
            output,
            type: "stdout",
            isComplete: false
          });
        }
      });

      process.stderr.on("data", (data) => {
        const output = data.toString();

        if (event.sender) {
          event.sender.send(outputChannel, {
            commandId,
            output,
            type: "stderr",
            isComplete: false
          });
        }
      });

      process.on("close", (code) => {
        const success = code === 0;

        if (event.sender) {
          event.sender.send(outputChannel, {
            commandId,
            output: success ? "Command completed successfully." : `Command exited with code ${code}`,
            type: success ? "stdout" : "stderr",
            isComplete: true,
            success
          });
        }
      });

      process.on("error", (err) => {
        if (event.sender) {
          event.sender.send(outputChannel, {
            commandId,
            output: `Error: ${err.message}`,
            type: "stderr",
            isComplete: true,
            success: false
          });
        }
      });

      return response;
    } catch (error) {
      console.error("Error running artisan command:", error);
      return {
        success: false,
        message: error.message,
        pendingMigrations: [],
        batches: []
      };
    }
  });

  ipcMain.handle("get-singular-form", (_, word) => {
    return pluralize.singular(word);
  });
}

module.exports = { registerProjectHandlers };
