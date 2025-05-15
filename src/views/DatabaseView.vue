<script setup lang="ts">
  import { computed, markRaw, onMounted, onUnmounted, reactive, ref, provide, toRaw } from 'vue';
  import { useRoute } from 'vue-router';

  import MainHeader from '@/components/MainHeader.vue';
  import Sidebar from '@/components/database/Sidebar.vue';
  import MainTabs from '@/components/database/MainTabs.vue';
  import TableContent from '@/components/TableContent.vue';
  import Terminal from '@/components/Terminal.vue';
  import Settings from '@/components/Settings.vue';
  import DatabaseSwitcher from '@/components/database/DatabaseSwitcher.vue';
  import LiveUpdates from '@/components/LiveUpdates.vue';
  import ProjectLogs from '@/components/ProjectLogs.vue';
  import Migrations from '@/components/Migrations.vue';
  import EnvEditor from '@/components/EnvEditor.vue';

  import { useConnectionsStore } from '@/store/connections';
  import { useTabsStore } from '@/store/tabs';
  import { useSplitPane } from '@/composables/useSplitPane';

  const ui = reactive({
    showSettings: false,
    showDatabaseSwitcher: false,
    showLiveUpdates: false,
    showProjectLogs: false,
    showMigrations: false,
    showEnvEditor: false,
  });

  const pendingMigrationsCount = ref(0);
  let migrationCheckIntervalId = ref<number | null>(null);

  async function checkPendingMigrations() {
    if (!connectionsStore.getSelectedProject) return;

    try {
      const config = {
        projectPath: connectionsStore.getSelectedProject.projectPath,
        usingSail: connectionsStore.getSelectedProject.usingSail,
        db_config: toRaw(connectionsStore.getSelectedProject.db_config),
      };

      const result = await window.ipcRenderer.invoke('get-migration-status', config);

      if (result.success) {
        pendingMigrationsCount.value = result.pendingMigrations.length;
      }
    } catch (error) {
      console.error('Error checking pending migrations:', error);
    }
  }

  function startMigrationChecking() {
    if (migrationCheckIntervalId.value) {
      clearInterval(migrationCheckIntervalId.value);
    }

    checkPendingMigrations();

    migrationCheckIntervalId.value = window.setInterval(() => {
      checkPendingMigrations();
    }, 5000);
  }

  function stopMigrationChecking() {
    if (migrationCheckIntervalId.value) {
      clearInterval(migrationCheckIntervalId.value);
      migrationCheckIntervalId.value = null;
    }
  }

  const TableContentComponent = markRaw(TableContent);

  const route = useRoute();
  const connectionsStore = useConnectionsStore();
  const tabsStore = useTabsStore();

  const projectId = computed(() => route.params.id as string);

  const { sidebarWidth, sidebarRef, startResize } = useSplitPane(180, 480);

  function showAlert(message: string, type: string) {
    window.dispatchEvent(
      new CustomEvent('show-alert', {
        detail: { message, type },
      })
    );
  }

  provide('showAlert', showAlert);

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();

      ui.showDatabaseSwitcher = true;
    }
  }

  function handleMigrationsClose() {
    ui.showMigrations = false;
    checkPendingMigrations();
  }

  onMounted(async () => {
    window.addEventListener('keydown', handleGlobalKeydown);

    await connectionsStore.loadConnections(projectId.value);
    startMigrationChecking();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    stopMigrationChecking();
  });
</script>

<template>
  <div v-cloak class="relative flex h-full flex-col" tabindex="0">
    <div class="bg-base-300 draggable absolute top-0 z-10 h-10 w-full"></div>

    <MainHeader
      @open-settings="ui.showSettings = true"
      @open-database-switcher="ui.showDatabaseSwitcher = true"
      @open-live-updates="ui.showLiveUpdates = true"
      @open-project-logs="ui.showProjectLogs = true"
      @open-migrations="ui.showMigrations = true"
      @open-env-editor="ui.showEnvEditor = true"
      :pending-migrations="pendingMigrationsCount"
    />

    <MainTabs />

    <div class="flex flex-1 overflow-hidden">
      <div ref="sidebarRef" class="h-full shrink-0" :style="{ width: `${sidebarWidth}px` }">
        <Sidebar />
      </div>

      <div
        class="bg-base-300 hover:bg-primary active:bg-primary w-0.5 shrink-0 cursor-col-resize transition-colors"
        @mousedown="startResize"
      ></div>

      <div class="flex h-full flex-1 flex-col overflow-hidden">
        <div class="h-full w-full flex-1 overflow-auto">
          <div v-if="!tabsStore.activeTableName" class="flex h-full items-center justify-center">
            <div class="text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="mx-auto mb-4 h-12 w-12"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                />
              </svg>
              <p>No tables open.</p>
            </div>
          </div>

          <keep-alive :include="'TableContent'">
            <component
              :is="TableContentComponent"
              v-if="tabsStore.activeTableName"
              :key="tabsStore.activeTableName"
              :tableName="tabsStore.activeTableName"
            />
          </keep-alive>
        </div>
      </div>
    </div>

    <footer class="bg-base-300 border-t border-black/10 px-4 py-1 text-xs">
      <div class="flex justify-between">
        <div>Database: {{ connectionsStore.getSelectedProject?.db_config.database }}</div>
        <Terminal />
      </div>
    </footer>

    <Settings v-if="ui.showSettings" @close="ui.showSettings = false" />
    <DatabaseSwitcher v-if="ui.showDatabaseSwitcher" @close="ui.showDatabaseSwitcher = false" />
    <LiveUpdates v-if="ui.showLiveUpdates" @close="ui.showLiveUpdates = false" />
    <ProjectLogs v-if="ui.showProjectLogs" @close="ui.showProjectLogs = false" />
    <Migrations
      v-if="ui.showMigrations"
      @close="handleMigrationsClose"
      @migrations-updated="checkPendingMigrations"
    />
    <EnvEditor v-if="ui.showEnvEditor" @close="ui.showEnvEditor = false" />
  </div>
</template>

<style scoped></style>
