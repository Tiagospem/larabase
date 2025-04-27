import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConnectionsStore } from "./connections";

export const useDatabaseStore = defineStore("database", () => {
  const tables = ref({});
  const isLoading = ref(false);
  const connectionStore = useConnectionsStore();
  const tableRecords = ref({});
  const tableStructures = ref({});
  const tableIndexes = ref({});
  const tableForeignKeys = ref({});
  const tableMigrations = ref({});
  const tableModels = ref({});
  const lastConnectionId = ref(null);

  const _EMPTY_RESULT = (page, limit) => ({
    data: [],
    totalRecords: 0,
    page,
    limit
  });

  const _getConnection = (id) => {
    const conn = connectionStore.getConnection(id);
    if (!conn) throw new Error("Connection not found");
    return conn;
  };

  const _buildPayload = (conn) => ({
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password,
    database: conn.database
  });

  const _prepare = (record) =>
    Object.fromEntries(
      Object.entries(record).map(([k, v]) => {
        if (v instanceof Date) return [k, v.toISOString().slice(0, 19)];
        if (v && typeof v === "object") {
          try {
            return [k, JSON.stringify(v)];
          } catch {
            return [k, String(v)];
          }
        }
        return [k, v];
      })
    );

  const _sanitize = (ids) => ids.map((id) => (id && typeof id === "object" ? String(id) : id));

  async function loadTableData(id, tableName, limit = 100, page = 1, sortOptions = {}) {
    try {
      const conn = _getConnection(id);

      const payload = {
        ..._buildPayload(conn),
        tableName,
        limit,
        page,
        sortColumn: sortOptions.sortColumn,
        sortDirection: sortOptions.sortDirection
      };

      const result = await window.api.getTableData(payload);

      if (result.success) {
        return {
          data: result.data || [],
          totalRecords: result.totalRecords || 0,
          page,
          limit
        };
      }

      return _EMPTY_RESULT(page, limit);
    } catch (error) {
      return _EMPTY_RESULT(page, limit);
    }
  }

  async function loadTables(id) {
    isLoading.value = true;

    try {
      if (lastConnectionId.value !== id) {
        clearCaches();
        lastConnectionId.value = id;
      }

      const conn = _getConnection(id);
      const result = await window.api.listTables(_buildPayload(conn));
      tables.value = result.success && result.tables ? { tables: result.tables } : { tables: [] };
      if (result.success && conn.projectPath) await loadModelsForTables(id, conn.projectPath);
    } catch {
      tables.value = { tables: [] };
    } finally {
      isLoading.value = false;
    }
  }

  async function loadModelsForTables(id, path) {
    if (!path) return;
    try {
      const { success, models } = await window.api.findModelsForTables({
        projectPath: path
      });
      if (success) tableModels.value[id] = models;
    } catch {}
  }

  function getModelForTable(id, name) {
    return tableModels.value[id]?.[name] || null;
  }

  function getTableModelJson(id, name) {
    const conn = connectionStore.getConnection(id) || {};
    const model = getModelForTable(id, name);
    return JSON.stringify(
      {
        connectionName: conn.name || "Unknown",
        database: conn.database || "Unknown",
        tableName: name,
        model: model
          ? {
              name: model.name,
              namespace: model.namespace,
              fullName: model.fullName,
              path: model.relativePath
            }
          : null
      },
      null,
      2
    );
  }

  async function getAllTablesModelsJson(id) {
    const conn = connectionStore.getConnection(id) || {};
    const result = {
      connectionName: conn.name || "Unknown",
      database: conn.database || "Unknown",
      tables: []
    };
    for (const { name, recordCount } of tables.value.tables || []) {
      try {
        const cols = await getTableStructure(id, name);
        const model = getModelForTable(id, name);
        result.tables.push({
          tableName: name,
          columns: cols.map((c) => ({
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            primary_key: c.primary_key,
            foreign_key: c.foreign_key,
            default: c.default
          })),
          model: model && { namespace: model.fullName }
        });
      } catch {
        const model = getModelForTable(id, name);
        result.tables.push({
          tableName: name,
          recordCount,
          columns: [],
          model
        });
      }
    }
    return JSON.stringify(result, null, 2);
  }

  async function getTableRecordCount(id, tableName, useCache = true, cacheTimeoutMs = 5000) {
    const key = `${id}:${tableName}`;

    if (useCache && tableRecords.value[key]?.count != null && tableRecords.value[key]?.timestamp && Date.now() - tableRecords.value[key].timestamp < cacheTimeoutMs) {
      return tableRecords.value[key].count;
    }

    try {
      const conn = connectionStore.getConnection(id);

      const { success, count } = await window.api.getTableRecordCount({
        ..._buildPayload(conn),
        tableName
      });

      if (success) {
        tableRecords.value[key] = {
          count: parseInt(count, 10),
          timestamp: Date.now()
        };
        return tableRecords.value[key].count;
      }
    } catch (error) {
      console.error(`Error getting record count for ${tableName}:`, error);
    }

    return tableRecords.value[key]?.count || 0;
  }

  async function getTableStructure(id, name, force = false) {
    const key = `${id}:${name}:structure`;
    if (!force && tableStructures.value[key]) return tableStructures.value[key];
    try {
      const conn = connectionStore.getConnection(id);
      const { success, columns } = await window.api.getTableStructure({
        ..._buildPayload(conn),
        tableName: name
      });
      if (success) tableStructures.value[key] = columns;
      return columns || [];
    } catch {
      return [];
    }
  }

  async function getTableIndexes(id, name, force = false) {
    const key = `${id}:${name}:indexes`;
    if (!force && tableIndexes.value[key]) return tableIndexes.value[key];
    await new Promise((r) => setTimeout(r, 500));
    const indexes = [
      {
        name: "PRIMARY",
        type: "PRIMARY",
        columns: ["id"],
        algorithm: "BTREE",
        cardinality: 0,
        comment: ""
      }
    ];
    tableIndexes.value[key] = indexes;
    return indexes;
  }

  async function getTableForeignKeys(id, name, force = false) {
    const key = `${id}:${name}:foreignKeys`;
    if (!force && tableForeignKeys.value[key]) return tableForeignKeys.value[key];
    try {
      const conn = connectionStore.getConnection(id);
      const { success, foreignKeys } = await window.api.getTableForeignKeys({
        ..._buildPayload(conn),
        tableName: name
      });
      if (success) tableForeignKeys.value[key] = foreignKeys;
      return foreignKeys || [];
    } catch {
      return [];
    }
  }

  async function getTableMigrations(id, name, force = false) {
    const key = `${id}:${name}:migrations`;
    if (!force && tableMigrations.value[key]) return tableMigrations.value[key];
    try {
      const conn = connectionStore.getConnection(id);
      if (!conn.projectPath) return [];
      const { success, migrations } = await window.api.findTableMigrations({
        projectPath: conn.projectPath,
        tableName: name
      });
      if (success) tableMigrations.value[key] = migrations;
      return migrations || [];
    } catch {
      return [];
    }
  }

  function clearTableCache(key) {
    delete tableRecords.value[key];
    delete tableStructures.value[key];
    delete tableIndexes.value[key];
    delete tableForeignKeys.value[key];
    delete tableMigrations.value[key];
  }

  function clearTableRecordCounts() {
    tableRecords.value = {};
  }

  async function updateRecord(id, tableName, record) {
    const conn = _getConnection(id);
    const prepared = _prepare(record);
    const result = await window.api.updateRecord({
      connection: _buildPayload(conn),
      tableName,
      record: prepared
    });
    if (!result.success) throw new Error(result.message);

    return result;
  }

  async function deleteRecords(id, tableName, ids, options = {}) {
    const conn = _getConnection(id);
    const sanitized = _sanitize(ids);

    const deleteConfig = {
      connection: _buildPayload(conn),
      tableName,
      ids: sanitized,
      ignoreForeignKeys: options.ignoreForeignKeys === true
    };

    const result = await window.api.deleteRecords(deleteConfig);

    clearTableCache(`${id}:${tableName}`);

    return result;
  }

  async function truncateTable(id, tableName) {
    const conn = _getConnection(id);
    const result = await window.api.truncateTable({
      connection: _buildPayload(conn),
      tableName
    });
    if (!result.success) throw new Error(result.message);
    clearTableCache(`${id}:${tableName}`);
    return result;
  }

  async function truncateTables(connectionId, tableNames, ignoreForeignKeys = false) {
    try {
      if (!connectionId || !tableNames || !tableNames.length) {
        console.error("Missing required parameters for truncateTables");
        return {
          success: false,
          message: "Missing required parameters",
          results: []
        };
      }

      const currentConnection = connectionStore.getConnection(connectionId);
      if (!currentConnection) {
        console.error(`Connection not found for ID: ${connectionId}`);
        return {
          success: false,
          message: "Connection not found",
          results: []
        };
      }

      const results = [];
      for (const tableName of tableNames) {
        try {
          const result = await truncateTable(connectionId, tableName);
          results.push({
            tableName,
            success: result.success,
            message: result.message
          });
        } catch (error) {
          console.error(`Error truncating table ${tableName}:`, error);
          results.push({
            tableName,
            success: false,
            message: error.message || "Error truncating table"
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      return {
        success: successCount > 0,
        results,
        message:
          failCount === 0
            ? `Successfully truncated ${successCount} table(s)`
            : successCount === 0
              ? `Failed to truncate ${failCount} table(s)`
              : `Truncated ${successCount} table(s), failed to truncate ${failCount}`
      };
    } catch (error) {
      console.error("Error truncating tables:", error);
      return {
        success: false,
        message: error.message || "An unknown error occurred",
        results: tableNames.map((tableName) => ({
          tableName,
          success: false,
          message: error.message || "Unknown error"
        }))
      };
    }
  }

  const tablesList = computed(() => tables.value.tables || []);

  function clearCaches() {
    tableRecords.value = {};
    tableStructures.value = {};
    tableIndexes.value = {};
    tableForeignKeys.value = {};
    tableMigrations.value = {};
  }

  function limitCacheSize(cacheObject, maxItems = 50) {
    const keys = Object.keys(cacheObject);
    if (keys.length > maxItems) {
      const keysToRemove = keys.slice(0, keys.length - maxItems);
      keysToRemove.forEach((key) => {
        delete cacheObject[key];
      });
    }
  }

  function manageCaches() {
    limitCacheSize(tableRecords.value);
    limitCacheSize(tableStructures.value);
    limitCacheSize(tableIndexes.value);
    limitCacheSize(tableForeignKeys.value);
    limitCacheSize(tableMigrations.value);
  }

  return {
    tables,
    isLoading,
    loadTables,
    loadTableData,
    getTableRecordCount,
    getTableStructure,
    getTableIndexes,
    getTableForeignKeys,
    getTableMigrations,
    loadModelsForTables,
    getModelForTable,
    getTableModelJson,
    getAllTablesModelsJson,
    clearTableCache,
    clearTableRecordCounts,
    updateRecord,
    deleteRecords,
    truncateTable,
    truncateTables,
    tablesList,
    getConnection: _getConnection,
    manageCaches
  };
});
