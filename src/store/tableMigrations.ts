import { defineStore } from 'pinia';
import { useConnectionsStore } from '@/store/connections';
import { ref, toRaw, computed } from 'vue';

export const useTableMigrationsStore = (tableName: string) => {
  return defineStore(`migrations-${tableName}`, () => {
    const connectionStore = useConnectionsStore();

    const migrations = ref<any[]>([]);
    const isLoading = ref(true);
    const selectedMigration = ref(null);

    const sortedMigrations = computed(() => {
      return [...migrations.value].sort((a, b) => {
        const getTimestamp = (name: string) => {
          const matches = name.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{6})/);
          if (matches) {
            return matches[0];
          }

          const numericMatches = name.match(/^(\d{14})/);
          if (numericMatches) {
            return numericMatches[0];
          }

          return name;
        };

        const aTimestamp = getTimestamp(a.name);
        const bTimestamp = getTimestamp(b.name);

        return bTimestamp.localeCompare(aTimestamp);
      });
    });

    async function getTableMigrations() {
      isLoading.value = true;

      try {
        const project = connectionStore.getSelectedProject;
        if (!project?.id || !project.projectPath) return [];

        const { success, migrations: migrationData } = await window.ipcRenderer.findTableMigrations(
          toRaw(connectionStore.getSelectedProject?.projectPath),
          tableName
        );

        if (success) {
          migrations.value = migrationData || [];
        }

        return migrationData || [];
      } catch (error) {
        console.error('Error loading migrations:', error);
        migrations.value = [];
        return [];
      } finally {
        isLoading.value = false;
      }
    }

    function setSelectedMigration(migration: any) {
      selectedMigration.value = migration;
    }

    function clearSelectedMigration() {
      selectedMigration.value = null;
    }

    return {
      migrations,
      sortedMigrations,
      isLoading,
      selectedMigration,
      getTableMigrations,
      setSelectedMigration,
      clearSelectedMigration,
    };
  })();
};
