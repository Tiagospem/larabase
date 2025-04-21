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

  const _updateCache = (key, { data, totalRecords }, page, limit, extra = {}) => {
    const cache = (tableRecords.value[key] = tableRecords.value[key] || {});
    Object.assign(cache, { data, totalRecords, page, limit }, extra);
  };

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

      console.log("loadTableData chamado com:", {
        tableName,
        limit,
        page,
        sortOptions
      });

      const payload = {
        ..._buildPayload(conn),
        tableName,
        limit,
        page,
        sortColumn: sortOptions.sortColumn,
        sortDirection: sortOptions.sortDirection
      };

      console.log("Enviando para getTableData:", JSON.stringify(payload));

      const result = await window.api.getTableData(payload);

      console.log("Resultado de getTableData:", {
        success: result.success,
        totalRecords: result.totalRecords,
        dataLength: result.data?.length
      });

      if (result.success) {
        const key = `${id}:${tableName}`;
        _updateCache(key, result, page, limit);
        return {
          data: result.data || [],
          totalRecords: result.totalRecords || 0,
          page,
          limit
        };
      }
      return _EMPTY_RESULT(page, limit);
    } catch (error) {
      console.error("Erro em loadTableData:", error);
      return _EMPTY_RESULT(page, limit);
    }
  }

  async function loadFilteredTableData(id, tableName, filter, limit = 100, page = 1, sortOptions = {}) {
    try {
      const conn = _getConnection(id);

      console.log("loadFilteredTableData chamado com:", {
        tableName,
        filter,
        limit,
        page,
        sortOptions
      });

      const payload = {
        ..._buildPayload(conn),
        tableName,
        filter,
        limit,
        page,
        sortColumn: sortOptions.sortColumn,
        sortDirection: sortOptions.sortDirection
      };

      console.log("Enviando para getFilteredTableData:", JSON.stringify(payload));

      const result = await window.api.getFilteredTableData(payload);

      console.log("Resultado de getFilteredTableData:", {
        success: result.success,
        totalRecords: result.totalRecords,
        dataLength: result.data?.length
      });

      if (result.success) {
        const key = `${id}:${tableName}:filtered`;
        _updateCache(key, result, page, limit, { filter });
        return {
          data: result.data || [],
          totalRecords: result.totalRecords || 0,
          page,
          limit
        };
      }
      return _EMPTY_RESULT(page, limit);
    } catch (error) {
      console.error("Erro em loadFilteredTableData:", error);
      return _EMPTY_RESULT(page, limit);
    }
  }

  async function loadTables(id) {
    isLoading.value = true;
    try {
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

  async function getTableRecordCount(id, tableName) {
    const key = `${id}:${tableName}`;
    if (tableRecords.value[key]?.count != null) return tableRecords.value[key].count;
    try {
      const conn = connectionStore.getConnection(id);
      const { success, count } = await window.api.getTableRecordCount({
        ..._buildPayload(conn),
        tableName
      });
      if (success) {
        tableRecords.value[key] = { count };
        return count;
      }
    } catch {}
    return 0;
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
    _updateCache(`${id}:${tableName}`, { data: [record], totalRecords: 1 }, 1, 1);
    return result;
  }

  async function deleteRecords(id, tableName, ids) {
    const conn = _getConnection(id);
    const sanitized = _sanitize(ids);
    const result = await window.api.deleteRecords({
      connection: _buildPayload(conn),
      tableName,
      ids: sanitized
    });
    if (!result.success) throw new Error(result.message);
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

  const tablesList = computed(() => tables.value.tables || []);

  return {
    tables,
    isLoading,
    loadTables,
    loadTableData,
    loadFilteredTableData,
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
    tablesList
  };
});
