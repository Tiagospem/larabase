import { useTabsStore } from '@/store/tabs';
import { useSidebarStore } from '@/store/sidebar';
import { Table } from '@/types/table';
import { ForeignKey } from '@/types/mysql-connection';
import { useConnectionsStore } from '@/store/connections';
import { toRaw } from 'vue';

export function useForeignKeyNavigation() {
  const tabsStore = useTabsStore();
  const sidebarStore = useSidebarStore();
  const connectionStore = useConnectionsStore();

  async function getTableForeignKeys(tableName: string): Promise<ForeignKey[]> {
    try {
      const selectedProject = connectionStore.getSelectedProject;

      if (!selectedProject) {
        console.error('No selected project found');
        return [];
      }

      if (!window.ipcRenderer) {
        console.error('IPC renderer not available');
        return [];
      }

      const result = await window.ipcRenderer.getTableForeignKeys(
        toRaw(selectedProject.db_config),
        tableName
      );

      if (result.success) {
        return result.foreignKeys || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching foreign keys:', error);
      return [];
    }
  }

  function isForeignKeyColumn(columnName: string, foreignKeys: ForeignKey[]): boolean {
    return foreignKeys.some(fk => fk.column === columnName && fk.type === 'outgoing');
  }

  async function navigateToForeignKey(
    tableName: string,
    column: string,
    value: any,
    onError?: (message: string) => void
  ): Promise<boolean> {
    if (value === null || value === undefined) {
      if (onError) onError('Null or undefined value. Unable to navigate to the related record.');
      return false;
    }

    const foreignKeys = await getTableForeignKeys(tableName);

    if (foreignKeys.length === 0) {
      if (onError) onError('Could not retrieve foreign keys for this table');
      return false;
    }

    if (!isForeignKeyColumn(column, foreignKeys)) {
      if (onError) onError(`Foreign key information not found for column "${column}"`);
      return false;
    }

    const foreignKey = foreignKeys.find(
      (fk: ForeignKey) => fk.column === column && fk.type === 'outgoing'
    );

    if (!foreignKey) {
      if (onError) onError(`Foreign key information not found for column "${column}"`);
      return false;
    }

    const targetTable = foreignKey.referenced_table;
    const targetColumn = foreignKey.referenced_column;

    if (!targetTable || !targetColumn) {
      if (onError) onError('Referenced table or column not found in foreign key');
      return false;
    }

    let filterValue = value;

    if (typeof value === 'string') {
      filterValue = `'${value.replace(/'/g, "''")}'`;
    }

    const filter = `${targetColumn} = ${filterValue}`;

    const findTable = sidebarStore.localTables.find((table: Table) => table.name === targetTable);

    if (findTable) {
      await tabsStore.openTable(findTable, filter);
      return true;
    }

    if (onError) onError(`Target table "${targetTable}" not found in the database`);
    return false;
  }

  return {
    navigateToForeignKey,
    getTableForeignKeys,
    isForeignKeyColumn,
  };
}
