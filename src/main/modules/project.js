const { ipcMain, dialog } = require("electron");
const { getMainWindow } = require("../modules/window");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const pluralize = require("pluralize");
const docker = require("./docker");

// Utility function to extract values from .env file
function extractEnvValue(content, key) {
  const regex = new RegExp(`^${key}=(.*)$`, "m");
  const match = content.match(regex);
  if (match && match[1]) {
    return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const DOCKER_SOCKET = "/var/run/docker.sock";

function socketExists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
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

async function checkDockerByOS() {
  // Use dockerode to check Docker availability
  return await docker.isDockerRunning();
}

async function isDockerCliAvailable() {
  // Direct check with dockerode
  return await docker.isDockerAvailable();
}

async function getDockerContainers() {
  return await docker.getDockerContainers();
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

  ipcMain.handle("find-table-migrations", async (event, config) => {
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

  ipcMain.handle("find-models-for-tables", async (_event, config = {}) => {
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

  ipcMain.handle("read-env-file", async (event, projectPath) => {
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

  ipcMain.handle("validate-laravel-project", async (event, projectPath) => {
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

  ipcMain.handle("compare-project-database", async (event, { projectPath, connectionDatabase }) => {
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

  ipcMain.handle("find-laravel-commands", async (event, projectPath) => {
    try {
      if (!projectPath) {
        return {
          success: false,
          message: "Missing project path",
          commands: []
        };
      }

      const commands = [];

      // Check for the main commands directories in different Laravel versions
      const commandDirs = [path.join(projectPath, "app", "Console", "Commands"), path.join(projectPath, "app", "Commands")];

      // Recursively process command files
      const processCommandFiles = (dir) => {
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Recursively process subdirectories
            processCommandFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".php")) {
            try {
              const content = fs.readFileSync(fullPath, "utf8");

              // Look for common command patterns
              const extendsCommand = /extends\s+Command|extends\s+BaseCommand/i.test(content);
              const implementsConsole = /implements\s+ConsoleCommand/i.test(content);

              if (!extendsCommand && !implementsConsole) continue;

              // Extract command information
              const classMatch = content.match(/class\s+(\w+)/);
              if (!classMatch) continue;

              const className = classMatch[1];
              const nameMatch = content.match(/protected\s+\$name\s*=\s*['"](.*?)['"]/);
              const signatureMatch = content.match(/protected\s+\$signature\s*=\s*['"](.*?)['"]/);
              const descriptionMatch = content.match(/protected\s+\$description\s*=\s*['"](.*?)['"]/);

              const commandName = nameMatch ? nameMatch[1] : signatureMatch ? signatureMatch[1].split(" ")[0] : null;
              const signature = signatureMatch ? signatureMatch[1] : nameMatch ? nameMatch[1] : null;
              const description = descriptionMatch ? descriptionMatch[1] : "";

              if (commandName || signature) {
                commands.push({
                  name: commandName || signature.split(" ")[0],
                  signature: signature,
                  description: description,
                  className: className,
                  path: fullPath,
                  relativePath: path.relative(projectPath, fullPath)
                });
              }
            } catch (err) {
              console.error(`Error parsing command file ${fullPath}:`, err);
            }
          }
        }
      };

      // Process all command directories
      for (const dir of commandDirs) {
        processCommandFiles(dir);
      }

      // Additionally, try to discover artisan commands using artisan list
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
                // Add built-in commands that don't have PHP files
                for (const cmdName in parsed.commands) {
                  const cmd = parsed.commands[cmdName];

                  // Skip already found custom commands
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

      // Sort commands by name
      commands.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        commands: commands
      };
    } catch (error) {
      console.error("Error finding Laravel commands:", error);
      return {
        success: false,
        message: error.message || "Failed to find Laravel commands",
        commands: []
      };
    }
  });
}

module.exports = { registerProjectHandlers, isDockerCliAvailable };
