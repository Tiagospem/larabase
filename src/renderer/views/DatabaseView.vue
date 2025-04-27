<template>
  <div
    v-cloak
    class="flex flex-col h-full relative"
    tabindex="0"
  >
    <div class="absolute w-full h-10 bg-base-300 top-0 draggable z-10"></div>

    <header class="bg-base-300 mt-8 pt-2 px-4 z-20 pb-2 border-b border-black/10 flex items-center justify-between">
      <div class="flex items-center">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center mr-2"
          :class="getConnectionColor(connection?.type)"
        >
          <span class="text-base-100 font-bold text-sm">{{ connection?.icon }}</span>
        </div>

        <ShowConnectionInfo :connection-id="connectionId" />
      </div>

      <div class="flex">
        <div class="border-r border-black/10 pr-2 mr-2">
          <button
            v-tooltip.bottom="'Database Structure'"
            class="btn btn-ghost btn-sm"
            title="Tables Models JSON"
            @click="showTablesModelsModal = true"
          >
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 320 512"
            >
              <path
                d="M80 160c0-35.3 28.7-64 64-64l32 0c35.3 0 64 28.7 64 64l0 3.6c0 21.8-11.1 42.1-29.4 53.8l-42.2 27.1c-25.2 16.2-40.4 44.1-40.4 74l0 1.4c0 17.7 14.3 32 32 32s32-14.3 32-32l0-1.4c0-8.2 4.2-15.8 11-20.2l42.2-27.1c36.6-23.6 58.8-64.1 58.8-107.7l0-3.6c0-70.7-57.3-128-128-128l-32 0C73.3 32 16 89.3 16 160c0 17.7 14.3 32 32 32s32-14.3 32-32zm80 320a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"
              />
            </svg>
          </button>

          <button
            v-tooltip.bottom="'Switch Database'"
            class="btn btn-ghost btn-sm"
            title="Switch Database"
            @click="databaseSwitchRef?.openDatabaseSwitcher()"
          >
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

          <button
            v-tooltip.bottom="'SQL Editor'"
            class="btn btn-ghost btn-sm"
            title="SQL Editor"
            @click="openSqlEditor"
          >
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

          <button
            v-tooltip.bottom="'Query Explain Tool'"
            class="btn btn-ghost btn-sm"
            title="Query Explain Tool"
            @click="openExplainTool"
          >
            <svg
              class="h-4 w-4"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 448 512"
            >
              <path
                d="M160 80c0-26.5 21.5-48 48-48l32 0c26.5 0 48 21.5 48 48l0 352c0 26.5-21.5 48-48 48l-32 0c-26.5 0-48-21.5-48-48l0-352zM0 272c0-26.5 21.5-48 48-48l32 0c26.5 0 48 21.5 48 48l0 160c0 26.5-21.5 48-48 48l-32 0c-26.5 0-48-21.5-48-48L0 272zM368 96l32 0c26.5 0 48 21.5 48 48l0 288c0 26.5-21.5 48-48 48l-32 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48z"
              />
            </svg>
          </button>

          <button
            v-tooltip.bottom="'DB Live Updates'"
            class="btn btn-ghost btn-sm"
            title="Live Updates"
            @click="showLiveUpdates = true"
          >
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

          <button
            v-tooltip.bottom="'Database Diagram'"
            class="btn btn-ghost btn-sm"
            title="Database Diagram"
            @click="showDatabaseDiagram = true"
          >
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

          <button
            v-tooltip.bottom="'Project Logs'"
            class="btn btn-ghost btn-sm"
            title="Project Logs"
            @click="showProjectLogs = true"
          >
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

          <button
            v-tooltip.bottom="'Migration UI'"
            class="btn btn-ghost btn-sm"
            title="Run Artisan Commands"
            @click="showArtisanCommands = true"
          >
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
          </button>

          <!-- Redis Manager Button -->
          <button
            :disabled="!hasRedisConnection"
            :class="{ 'opacity-20': !hasRedisConnection }"
            v-tooltip.bottom="'Redis Manager'"
            class="btn btn-ghost btn-sm"
            title="Redis Manager"
            @click="showRedisManager = true"
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

          <!-- Env Editor Button -->
          <button
            v-tooltip.bottom="'.env Editor'"
            class="btn btn-ghost btn-sm"
            title=".env Editor"
            @click="showEnvEditor = true"
          >
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

          <!-- Laravel Commands Button -->
          <button
            v-tooltip.bottom="'Laravel Commands'"
            class="btn btn-ghost btn-sm"
            title="Laravel Commands"
            @click="showLaravelCommands = true"
          >
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

        <div class="flex">
          <button
            v-tooltip.left="'Configuration'"
            class="btn btn-ghost btn-sm"
            @click="showSettings = true"
          >
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
    </header>

    <MainTabs
      ref="mainTabsRef"
      :connection-id="connectionId"
    />

    <div class="flex flex-1 overflow-hidden">
      <TablesSidebar
        :connection-id="connectionId"
        :active-tab-name="activeTab?.tableName"
        :sidebar-width="sidebarWidth"
        :style="{ width: `${sidebarWidth}px` }"
        @resize-start="startResize"
        @table-open="mainTabsRef?.openTable"
        @close-tabs="closeDeletedTableTabs"
        @update:sidebar-width="sidebarWidth = $event"
      />

      <div class="flex-1 bg-base-200 overflow-hidden">
        <div
          v-if="!activeTab"
          class="flex items-center justify-center h-full"
        >
          <div class="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-12 h-12 mx-auto mb-4"
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
            v-if="activeTab"
            :key="activeTab.id"
            :connection-id="activeTab.connectionId"
            :table-name="activeTab.tableName"
            :filter="activeTab.filter || ''"
            @update-tab-data="mainTabsRef?.handleUpdateTabData"
            @open-tab="mainTabsRef?.handleOpenTab"
          />
        </keep-alive>
      </div>
    </div>

    <footer class="bg-base-300 px-4 py-1 text-xs border-t border-black/10">
      <div class="flex justify-between">
        <div>
          {{ connection?.type.toUpperCase() }} |
          {{ connection?.host || connection?.path }}
        </div>
        <div>Total tables: {{ databaseStore.tablesList.length }}</div>
      </div>
    </footer>
  </div>

  <ProjectLogs
    :is-open="showProjectLogs"
    :connection-id="connectionId"
    :project-path="connection?.projectPath"
    @close="showProjectLogs = false"
    @select-project="handleSelectProject"
  />

  <LiveUpdates
    :is-open="showLiveUpdates"
    :connection-id="connectionId"
    @close="showLiveUpdates = false"
    @goto-table="handleGotoTable"
  />

  <DatabaseDiagram
    :is-open="showDatabaseDiagram"
    :connection-id="connectionId"
    @close="showDatabaseDiagram = false"
  />

  <Settings
    v-if="showSettings"
    @close="showSettings = false"
  />

  <ArtisanCommands
    v-if="showArtisanCommands"
    :connection-id="connectionId"
    :project-path="connection?.projectPath"
    @close="showArtisanCommands = false"
  />

  <LaravelCommands
    v-if="showLaravelCommands"
    :connection-id="connectionId"
    :project-path="connection?.projectPath"
    :connection="connection"
    @close="showLaravelCommands = false"
    @update-project-path="handleUpdateProjectPath"
  />

  <CommandOutput />

  <DatabaseSwitcher
    :connection-id="connectionId"
    ref="databaseSwitchRef"
  />

  <RedisManager
    v-if="showRedisManager"
    :is-open="showRedisManager"
    :connection-id="connectionId"
    :connection="connection"
    @close="showRedisManager = false"
  />

  <EnvEditor
    v-if="showEnvEditor"
    :is-open="showEnvEditor"
    :connection-id="connectionId"
    @close="showEnvEditor = false"
  />

  <div
    v-if="connectionError"
    class="modal modal-open"
  >
    <div class="modal-box bg-base-300">
      <h3 class="font-bold text-lg">Connection Error</h3>
      <p class="py-4">
        {{ connectionErrorMessage }}
      </p>
      <div class="modal-action">
        <button
          class="btn btn-primary"
          @click="router.push('/')"
        >
          Back to Home
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="showTablesModelsModal"
    class="modal modal-open"
  >
    <div class="modal-box w-11/12 max-w-5xl max-h-[90vh] bg-base-300">
      <h3 class="font-bold text-lg mb-4">All Tables Models Data</h3>
      <div class="bg-base-200 mb-4 h-[60vh] overflow-auto">
        <pre><code>{{ allTablesModelsJson }}</code></pre>
      </div>
      <div class="modal-action">
        <button
          class="btn btn-sm btn-primary"
          @click="copyAllTablesJsonToClipboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 mr-1"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
            />
          </svg>
          Copy to Clipboard
        </button>
        <button
          class="btn"
          @click="showTablesModelsModal = false"
        >
          Close
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="showTablesModelsModal = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, markRaw, nextTick, watch, onBeforeMount, onUnmounted, onActivated } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useConnectionsStore } from "@/store/connections";
import { useDatabaseStore } from "@/store/database";
import { useTabsStore } from "@/store/tabs";
import TableContent from "../components/TableContent.vue";
import TablesSidebar from "../components/TablesSidebar.vue";
import ProjectLogs from "../components/ProjectLogs.vue";
import LiveUpdates from "../components/LiveUpdates.vue";
import DatabaseDiagram from "../components/DatabaseDiagram.vue";
import Settings from "../components/Settings.vue";
import ArtisanCommands from "../components/ArtisanCommands.vue";
import CommandOutput from "../components/CommandOutput.vue";
import MainTabs from "../components/database/MainTabs.vue";
import ShowConnectionInfo from "@/components/database/ShowConnectionInfo.vue";
import DatabaseSwitcher from "@/components/database/DatabaseSwitcher.vue";
import RedisManager from "@/components/RedisManager.vue";
import LaravelCommands from "../components/LaravelCommands.vue";
import EnvEditor from "@/components/EnvEditor.vue";

defineOptions({
  name: "DatabaseView"
});

const TableContentComponent = markRaw(TableContent);

const route = useRoute();
const router = useRouter();
const connectionId = computed(() => route.params.id);

const showAlert = inject("showAlert");

const connectionsStore = useConnectionsStore();
const databaseStore = useDatabaseStore();
const tabsStore = useTabsStore();

const databaseSwitchRef = ref(null);
const mainTabsRef = ref(null);
const sidebarWidth = ref(240);
const initialSidebarLoaded = ref(false);
const isResizing = ref(false);
const connectionError = ref(false);
const connectionErrorMessage = ref("");
const showProjectLogs = ref(false);
const showLiveUpdates = ref(false);
const showDatabaseDiagram = ref(false);
const showTablesModelsModal = ref(false);
const allTablesModelsJson = ref("");
const showSettings = ref(false);
const showArtisanCommands = ref(false);
const showRedisManager = ref(false);
const showLaravelCommands = ref(false);
const showEnvEditor = ref(false);
const isRedisAvailable = ref(false);
const hasRedisConnection = computed(() => isRedisAvailable.value);

const connection = computed(() => {
  return connectionsStore.getConnection(connectionId.value);
});

const activeTab = computed(() => tabsStore.activeTab);

window.getTableModelJson = (tableName) => {
  if (!tableName || !connectionId.value) return null;
  return databaseStore.getTableModelJson(connectionId.value, tableName);
};

window.getAllTablesModelsJson = async () => {
  if (!connectionId.value) return null;
  return await databaseStore.getAllTablesModelsJson(connectionId.value);
};

function startResize(e) {
  isResizing.value = true;

  document.documentElement.classList.add("resizing");
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);

  e.preventDefault();
  e.stopPropagation();
}

function onResize(e) {
  if (isResizing.value) {
    sidebarWidth.value = Math.max(200, Math.min(500, e.clientX));
    e.preventDefault();
  }
}

function stopResize() {
  isResizing.value = false;

  document.documentElement.classList.remove("resizing");
  document.body.style.userSelect = "";
  document.body.style.cursor = "";

  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);

  localStorage.setItem("sidebarWidth", sidebarWidth.value.toString());
}

async function testConnection() {
  if (!connection.value) {
    connectionError.value = true;
    connectionErrorMessage.value = "Connection not found";
    return false;
  }

  try {
    const testResult = await window.api.testMySQLConnection({
      host: connection.value.host,
      port: connection.value.port,
      username: connection.value.username,
      password: connection.value.password,
      database: connection.value.database
    });

    if (!testResult.success) {
      connectionError.value = true;
      connectionErrorMessage.value = `Failed to connect to database: ${testResult.message}`;
      return false;
    }

    return true;
  } catch (error) {
    connectionError.value = true;
    connectionErrorMessage.value = `Error testing connection: ${error.message}`;
    return false;
  }
}

const loadedConnections = ref(new Set());
const initialConnectionLoad = ref(false);

onBeforeMount(() => {
  loadSidebarWidth();
});

const lastTabCount = ref(0);

function manageMemory() {
  databaseStore.manageCaches();

  const currentTabCount = tabsStore.openTabs.length;

  if (lastTabCount.value > 8 && currentTabCount < 4) {
    setTimeout(() => {
      if (window.gc) window.gc();
    }, 100);
  }
  lastTabCount.value = currentTabCount;
}

onUnmounted(() => {
  window.removeEventListener("resize", mainTabsRef.value?.checkScrollPosition);
});

watch(
  () => tabsStore.openTabs.length,
  () => {
    manageMemory();
  }
);

async function initializeConnection(skipReload = false) {
  try {
    if (!skipReload) {
      await tabsStore.loadSavedTabs();
      await connectionsStore.loadConnections();
    }

    if (!connection.value) {
      connectionError.value = true;
      connectionErrorMessage.value = "Connection not found";
      return;
    }

    if (!loadedConnections.value.has(connectionId.value)) {
      const connectionValid = await testConnection();
      if (!connectionValid) {
        return;
      }

      await databaseStore.loadTables(connectionId.value);
      loadedConnections.value.add(connectionId.value);
    }

    await checkRedisAvailability();

    if (!skipReload) {
      databaseStore.clearTableRecordCounts();
    }

    window.addEventListener("resize", mainTabsRef.value?.checkScrollPosition);

    await nextTick(() => {
      mainTabsRef.value?.scrollToActiveTab();
      mainTabsRef.value?.checkScrollPosition();
    });

    document.querySelector(".flex.flex-col.h-full")?.focus();
    initialConnectionLoad.value = true;

    manageMemory();
  } catch (error) {
    console.error(error);
    connectionError.value = true;
    connectionErrorMessage.value = error.message || "Unknown error occurred";
  }
}

onMounted(async () => {
  await initializeConnection(false);
});

onActivated(async () => {
  if (initialConnectionLoad.value) {
    await nextTick(() => {
      mainTabsRef.value?.scrollToActiveTab();
      mainTabsRef.value?.checkScrollPosition();
    });
  } else {
    await initializeConnection(false);
  }
});

function getConnectionColor(type) {
  switch (type) {
    case "mysql":
      return "bg-orange-500";
    case "postgresql":
      return "bg-blue-600";
    default:
      return "bg-gray-600";
  }
}

function handleGotoTable(tableName) {
  const tableData = databaseStore.tablesList.find((t) => t.name === tableName);
  if (tableData) {
    mainTabsRef?.value.openTable(tableData);
  } else {
    showAlert(`Table "${tableName}" not found`, "error");
  }
}

function handleSelectProject() {
  selectProjectPath();
}

async function selectProjectPath() {
  try {
    const result = await window.api.selectDirectory();
    if (result.canceled) return;

    const selectedPath = result.filePaths[0];
    const isLaravelProject = await window.api.validateLaravelProject(selectedPath);

    if (!isLaravelProject) {
      showAlert("Selected directory is not a valid Laravel project", "error");
      return;
    }

    await connectionsStore.updateConnection(connectionId.value, {
      projectPath: selectedPath
    });

    showAlert("Laravel project path set successfully", "success");
  } catch (error) {
    console.error("Error selecting project path:", error);
    showAlert("Failed to select project path: " + error.message, "error");
  }
}

async function copyAllTablesJsonToClipboard() {
  try {
    await navigator.clipboard.writeText(allTablesModelsJson.value);
    showAlert("JSON copied to clipboard", "success");
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    showAlert("Failed to copy to clipboard", "error");
  }
}

watch(showTablesModelsModal, async (isOpen) => {
  if (isOpen) {
    try {
      allTablesModelsJson.value = "Loading table data...";

      allTablesModelsJson.value = await databaseStore.getAllTablesModelsJson(connectionId.value);
    } catch (error) {
      console.error("Error loading tables data:", error);
      allTablesModelsJson.value = JSON.stringify({ error: "Failed to load table data" }, null, 2);
    }
  }
});

function openSqlEditor() {
  router.push(`/sql-editor/${connectionId.value}`);
}

function openExplainTool() {
  router.push(`/explain/${connectionId.value}`);
}

function loadSidebarWidth() {
  const savedSidebarWidth = localStorage.getItem("sidebarWidth");
  if (savedSidebarWidth) {
    sidebarWidth.value = parseInt(savedSidebarWidth, 10);
  }
  initialSidebarLoaded.value = true;
}

async function checkRedisAvailability() {
  if (!connection.value?.redis) {
    isRedisAvailable.value = false;
    return;
  }

  try {
    const redisConfig = connection.value.redis;

    const result = await window.api.checkRedisStatus({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      path: redisConfig.path
    });

    isRedisAvailable.value = result.success;
  } catch (error) {
    console.error("Error checking Redis availability:", error);
    isRedisAvailable.value = false;
  }
}

function closeDeletedTableTabs(deletedTableNames) {
  if (!deletedTableNames || !deletedTableNames.length) return;

  try {
    const currentTabs = tabsStore.openTabs || [];

    deletedTableNames.forEach((tableName) => {
      const tabsToClose = currentTabs.filter((tab) => tab.connectionId === connectionId.value && tab.tableName === tableName);

      if (tabsToClose && tabsToClose.length > 0) {
        tabsToClose.forEach((tab) => {
          tabsStore.removeTab(tab.id);
        });
      }
    });

    tabsStore.saveOpenTabs();
  } catch (error) {
    console.error("Error closing deleted table tabs:", error);
    showAlert(`Error closing tabs: ${error.message}`, "error");
  }
}

function handleUpdateProjectPath(newProjectPath) {
  if (!connection.value || !newProjectPath) return;

  connectionsStore
    .updateConnection(connectionId.value, {
      projectPath: newProjectPath
    })
    .then(() => {
      showAlert(`Project path updated to ${newProjectPath}`, "success");
    })
    .catch((error) => {
      console.error("Error updating project path:", error);
      showAlert(`Failed to update project path: ${error.message}`, "error");
    });
}
</script>
