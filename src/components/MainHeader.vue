<script setup lang="ts">
  import { useConnectionsStore } from '@/store/connections';
  import { useRedisStore } from '@/store/redis';
  import { ProjectConnection } from '@/types/project';
  import { watchEffect, reactive, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import ShowConnectionInfo from '@/components/ShowConnectionInfo.vue';
  import DatabaseSchemaViewer from '@/components/schema/DatabaseSchemaViewer.vue';
  import ERDModal from '@/components/ERDModal.vue';
  import { useDatabaseSchema } from '@/services/databaseSchema';
  import RedisManager from '@/components/RedisManager.vue';

  const connectionsStore = useConnectionsStore();
  const redisStore = useRedisStore();
  const router = useRouter();
  const {
    databaseSchema,
    isLoading: isLoadingSchema,
    fetchDatabaseSchema,
    initializeSchema,
  } = useDatabaseSchema();

  const props = defineProps({
    pendingMigrations: {
      type: Number,
      default: 0,
    },
  });

  const emit = defineEmits([
    'open-settings',
    'open-database-switcher',
    'open-live-updates',
    'open-project-logs',
    'open-migrations',
    'open-env-editor',
  ]);

  const selectedProject = computed(() => connectionsStore.getSelectedProject);

  const isRedisAvailable = computed(() => {
    return redisStore.isRedisAvailable;
  });

  const isLoading = computed(() => {
    return connectionsStore.isLoading || !selectedProject;
  });

  const ui = reactive({
    showTablesModelsModal: false,
    showDatabaseDiagram: false,
    showRedisManager: false,
    showLaravelCommands: false,
  });

  function getConnectionColor(type: string) {
    switch (type) {
      case 'mysql':
        return 'bg-orange-500';
      case 'postgresql':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  }

  function openSqlEditor() {
    router.push(`/sql-editor/${selectedProject.value?.id}`);
  }

  function openExplainTool() {
    router.push(`/explain/${selectedProject.value?.id}`);
  }

  async function getDatabaseSchema() {
    try {
      const result = await fetchDatabaseSchema(true);

      if (result && result.tables && result.tables.length > 0) {
        ui.showTablesModelsModal = true;
      }
    } catch (error) {
      console.error('Error getting database schema:', error);
      alert(
        'Error getting database schema: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  onMounted(() => {
    initializeSchema();
  });

  watchEffect(() => {
    if (selectedProject.value?.id) {
      redisStore.checkRedisAvailability(selectedProject.value as ProjectConnection);
    }
  });

  ui.showRedisManager = false;
</script>

<template>
  <header
    v-if="!isLoading"
    class="bg-base-300 z-20 mt-8 flex items-center justify-between border-b border-black/10 px-4 pt-2 pb-2"
  >
    <div class="flex items-center">
      <div
        class="mr-2 flex h-8 w-8 items-center justify-center rounded-full"
        :class="getConnectionColor(selectedProject?.type as string)"
      >
        <span class="text-base-100 text-sm font-bold">{{ selectedProject?.icon }}</span>
      </div>

      <ShowConnectionInfo />
    </div>

    <div class="flex">
      <div class="mr-2 border-r border-black/10 pr-2">
        <div class="tooltip tooltip-bottom" data-tip="View database structure and relationships">
          <button
            class="btn btn-ghost btn-sm"
            @click="getDatabaseSchema"
            :disabled="isLoadingSchema"
          >
            <span v-if="isLoadingSchema" class="loading loading-spinner loading-xs"></span>
            <svg
              v-else
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path
                d="M64 256l0-96 160 0 0 96L64 256zm0 64l160 0 0 96L64 416l0-96zm224 96l0-96 160 0 0 96-160 0zM448 256l-160 0 0-96 160 0 0 96zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Change database or project connection">
          <button class="btn btn-ghost btn-sm" @click="emit('open-database-switcher')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 448 512"
            >
              <path
                d="M448 80l0 48c0 44.2-100.3 80-224 80S0 172.2 0 128L0 80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.9-16.9 54.8-28.6L448 288c0 44.2-100.3 80-224 80S0 332.2 0 288L0 186.1c14.9 11.8 34 21.2 54.8 28.6C99.7 230.7 159.5 240 224 240s124.3-9.3 169.2-25.3zM0 346.1c14.9 11.8 34 21.2 54.8 28.6C99.7 390.7 159.5 400 224 400s124.3-9.3 169.2-25.3c20.8-7.4 39.9-16.9 54.8-28.6l0 85.9c0 44.2-100.3 80-224 80S0 476.2 0 432l0-85.9z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Monitor database changes in real-time">
          <button class="btn btn-ghost btn-sm" @click="emit('open-live-updates')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
            >
              <path
                d="M80.3 44C69.8 69.9 64 98.2 64 128s5.8 58.1 16.3 84c6.6 16.4-1.3 35-17.7 41.7s-35-1.3-41.7-17.7C7.4 202.6 0 166.1 0 128S7.4 53.4 20.9 20C27.6 3.6 46.2-4.3 62.6 2.3S86.9 27.6 80.3 44zM555.1 20C568.6 53.4 576 89.9 576 128s-7.4 74.6-20.9 108c-6.6 16.4-25.3 24.3-41.7 17.7S489.1 228.4 495.7 212c10.5-25.9 16.3-54.2 16.3-84s-5.8-58.1-16.3-84C489.1 27.6 497 9 513.4 2.3s35 1.3 41.7 17.7zM352 128c0 23.7-12.9 44.4-32 55.4L320 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-296.6c-19.1-11.1-32-31.7-32-55.4c0-35.3 28.7-64 64-64s64 28.7 64 64zM170.6 76.8C163.8 92.4 160 109.7 160 128s3.8 35.6 10.6 51.2c7.1 16.2-.3 35.1-16.5 42.1s-35.1-.3-42.1-16.5c-10.3-23.6-16-49.6-16-76.8s5.7-53.2 16-76.8c7.1-16.2 25.9-23.6 42.1-16.5s23.6 25.9 16.5 42.1zM464 51.2c10.3 23.6 16 49.6 16 76.8s-5.7 53.2-16 76.8c-7.1 16.2-25.9 23.6-42.1 16.5s-23.6-25.9-16.5-42.1c6.8-15.6 10.6-32.9 10.6-51.2s-3.8-35.6-10.6-51.2c-7.1-16.2 .3-35.1 16.5-42.1s35.1 .3 42.1 16.5z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="View application logs and errors">
          <button class="btn btn-ghost btn-sm" @click="emit('open-project-logs')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
            >
              <path
                d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 38.6C310.1 219.5 256 287.4 256 368c0 59.1 29.1 111.3 73.7 143.3c-3.2 .5-6.4 .7-9.7 .7L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128zm48 96a144 144 0 1 1 0 288 144 144 0 1 1 0-288zm0 240a24 24 0 1 0 0-48 24 24 0 1 0 0 48zm0-192c-8.8 0-16 7.2-16 16l0 80c0 8.8 7.2 16 16 16s16-7.2 16-16l0-80c0-8.8-7.2-16-16-16z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Manage migrations and artisan commands">
          <button class="btn btn-ghost btn-sm relative" @click="emit('open-migrations')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path
                d="M192 104.8c0-9.2-5.8-17.3-13.2-22.8C167.2 73.3 160 61.3 160 48c0-26.5 28.7-48 64-48s64 21.5 64 48c0 13.3-7.2 25.3-18.8 34c-7.4 5.5-13.2 13.6-13.2 22.8c0 12.8 10.4 23.2 23.2 23.2l56.8 0c26.5 0 48 21.5 48 48l0 56.8c0 12.8 10.4 23.2 23.2 23.2c9.2 0 17.3-5.8 22.8-13.2c8.7-11.6 20.7-18.8 34-18.8c26.5 0 48 28.7 48 64s-21.5 64-48 64c-13.3 0-25.3-7.2-34-18.8c-5.5-7.4-13.6-13.2-22.8-13.2c-12.8 0-23.2 10.4-23.2 23.2L384 464c0 26.5-21.5 48-48 48l-56.8 0c-12.8 0-23.2-10.4-23.2-23.2c0-9.2 5.8-17.3 13.2-22.8c11.6-8.7 18.8-20.7 18.8-34c0-26.5-28.7-48-64-48s-64 21.5-64 48c0 13.3 7.2 25.3 18.8 34c7.4 5.5 13.2 13.6 13.2 22.8c0 12.8-10.4 23.2-23.2 23.2L48 512c-26.5 0-48-21.5-48-48L0 343.2C0 330.4 10.4 320 23.2 320c9.2 0 17.3 5.8 22.8 13.2C54.7 344.8 66.7 352 80 352c26.5 0 48-28.7 48-64s-21.5-64-48-64c-13.3 0-25.3 7.2-34 18.8C40.5 250.2 32.4 256 23.2 256C10.4 256 0 245.6 0 232.8L0 176c0-26.5 21.5-48 48-48l120.8 0c12.8 0 23.2-10.4 23.2-23.2z"
              />
            </svg>
            <span
              v-if="props.pendingMigrations > 0"
              class="bg-accent absolute -top-1 -right-1 z-50 flex h-4 w-4 animate-pulse items-center justify-center rounded-full text-[10px] text-white"
            >
              {{ props.pendingMigrations > 99 ? '99+' : props.pendingMigrations }}
            </span>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Edit .env configuration">
          <button class="btn btn-ghost btn-sm" @click="emit('open-env-editor')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path
                d="M208 32c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 140.9 122-70.4c15.3-8.8 34.9-3.6 43.7 11.7l16 27.7c8.8 15.3 3.6 34.9-11.7 43.7L352 256l122 70.4c15.3 8.8 20.6 28.4 11.7 43.7l-16 27.7c-8.8 15.3-28.4 20.6-43.7 11.7L304 339.1 304 480c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-140.9L86 409.6c-15.3 8.8-34.9 3.6-43.7-11.7l-16-27.7c-8.8-15.3-3.6-34.9 11.7-43.7L160 256 38 185.6c-15.3-8.8-20.5-28.4-11.7-43.7l16-27.7C51.1 98.8 70.7 93.6 86 102.4l122 70.4L208 32z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="SQL query editor">
          <button class="btn btn-ghost btn-sm" @click="openSqlEditor">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 384 512"
            >
              <path
                d="M64 0C28.7 0 0 28.7 0 64L0 448c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-288-128 0c-17.7 0-32-14.3-32-32L224 0 64 0zM256 0l0 128 128 0L256 0zM153 289l-31 31 31 31c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L71 337c-9.4-9.4-9.4-24.6 0-33.9l48-48c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9zM265 255l48 48c9.4 9.4 9.4 24.6 0 33.9l-48 48c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l31-31-31-31c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Visualize database table relationships">
          <button class="btn btn-ghost btn-sm" @click="ui.showDatabaseDiagram = true">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path
                d="M80 32C53.5 32 32 53.5 32 80s21.5 48 48 48l152 0 0 40-48 48-56 0c-48.6 0-88 39.4-88 88l0 48-8 0c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-8 0 0-48c0-22.1 17.9-40 40-40l56 0 48 48 0 40-8 0c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-8 0 0-40 48-48 56 0c22.1 0 40 17.9 40 40l0 48-8 0c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l64 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-8 0 0-48c0-48.6-39.4-88-88-88l-56 0-48-48 0-40 152 0c26.5 0 48-21.5 48-48s-21.5-48-48-48L80 32z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Show Redis Keys">
          <button
            :disabled="!isRedisAvailable"
            :class="{ 'opacity-20': !isRedisAvailable }"
            class="btn btn-ghost btn-sm"
            @click="ui.showRedisManager = true"
          >
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
            >
              <path
                d="M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z"
              />
            </svg>
          </button>
        </div>

        <div class="tooltip tooltip-bottom" data-tip="Run Project Commands">
          <button disabled class="btn btn-ghost btn-sm" @click="ui.showLaravelCommands = true">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 576 512"
            >
              <path
                d="M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex">
        <div class="tooltip tooltip-left" data-tip="Settings">
          <button class="btn btn-ghost btn-sm" @click="emit('open-settings')">
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
            >
              <path
                d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </header>

  <DatabaseSchemaViewer
    :show="ui.showTablesModelsModal"
    :schema-data="databaseSchema || { tables: [] }"
    @close="ui.showTablesModelsModal = false"
  />

  <ERDModal :show="ui.showDatabaseDiagram" @close="ui.showDatabaseDiagram = false" />

  <RedisManager :show="ui.showRedisManager" @close="ui.showRedisManager = false" />
</template>
