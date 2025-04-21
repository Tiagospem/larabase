const { ipcMain, dialog } = require("electron");
const { getMainWindow } = require("../modules/window");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const pluralize = require("pluralize");

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

function checkDockerByOS() {
  const platform = process.platform;

  if (platform === "darwin") {
    if (!socketExists(DOCKER_SOCKET)) return false;
    return Boolean(execCommand('ps aux | grep -v grep | grep -E "Docker(Desktop|.app)"'));
  }

  if (platform === "linux") {
    if (socketExists(DOCKER_SOCKET)) return true;

    execCommand("systemctl is-active --quiet docker");
    return true;
  }

  if (platform === "win32") {
    const hasDesktop = execCommand('tasklist /FI "IMAGENAME eq Docker Desktop.exe" /NH');
    if (hasDesktop.includes("Docker Desktop.exe")) return true;
    return execCommand("sc query docker").includes("RUNNING");
  }

  return false;
}

function isDockerCliAvailable() {
  if (execCommand("docker --version", { timeout: 3000 })) {
    return true;
  }

  if (checkDockerByOS()) {
    return true;
  }

  if (process.platform !== "win32" && socketExists(DOCKER_SOCKET)) {
    return true;
  }

  return process.platform === "win32" && socketExists("C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe");
}

function getDockerContainers() {
  const output = execCommand('docker ps --format "{{.Names}} {{.Ports}}"', {
    timeout: 5000
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectDockerMysql(port) {
  const result = {
    dockerAvailable: false,
    isDocker: false,
    dockerContainerName: null,
    message: ""
  };

  if (!isDockerCliAvailable()) {
    result.message = "Docker CLI is not available";
    return result;
  }
  result.dockerAvailable = true;

  let containers = [];

  try {
    containers = getDockerContainers();
    console.info("Active Docker containers:", containers);
  } catch (err) {
    console.error("Error listing Docker containers:", err.message);
    result.message = "Docker detected but container listing failed. Check permissions.";
  }

  const portRegex = new RegExp(`(?:^|\\s)(\\S+).*?\\b${port}:?->?3306\\b`);

  for (const line of containers) {
    const m = portRegex.exec(line);
    if (m) {
      result.isDocker = true;
      result.dockerContainerName = m[1];
      result.message = `MySQL Docker container found: ${m[1]}`;
      return result;
    }
  }

  for (const line of containers) {
    if (/mysql|mariadb/i.test(line)) {
      const name = line.split(" ")[0];
      result.isDocker = true;
      result.dockerContainerName = name;
      result.message = `MySQL-like container found: ${name} (not on port ${port})`;
      console.info(`Found MySQL-like container: ${name}`);
      return result;
    }
  }

  if (process.platform !== "win32") {
    const ps = execCommand('ps aux | grep -v grep | grep -E "mysql|mariadb"');
    if (ps) {
      result.isDocker = true;
      result.dockerContainerName = "mysql-container";
      result.message = "MySQL process detected, assuming Docker container";
      return result;
    }
  }

  result.message = result.message || `No MySQL Docker container found on port ${port}`;
  return result;
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
        envConfig.dockerInfo = detectDockerMysql(envConfig.DB_PORT);
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
}

module.exports = { registerProjectHandlers, isDockerCliAvailable };
