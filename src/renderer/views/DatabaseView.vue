<template>
  <div
    v-cloak
    class="flex flex-col h-full"
    tabindex="0"
  >
    <header class="bg-neutral px-4 py-2 border-b border-neutral flex items-center justify-between">
      <div class="flex items-center">
        <button
          v-tooltip.right="'Back to connections'"
          class="btn btn-ghost btn-sm mr-2"
          @click="router.push('/')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
            />
          </svg>
        </button>

        <div
          class="w-8 h-8 rounded-full flex items-center justify-center mr-2"
          :class="getConnectionColor(connection?.type)"
        >
          <span class="text-white font-bold text-sm">{{ connection?.icon }}</span>
        </div>

        <ShowConnectionInfo :connection-id="connectionId" />
      </div>

      <div class="flex">
        <div class="border-r border-neutral-700 pr-2 mr-2">
          <button
            v-tooltip.bottom="'Database Structure'"
            class="btn btn-ghost btn-sm"
            title="Tables Models JSON"
            @click="showTablesModelsModal = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
              />
            </svg>
          </button>

          <button
            v-tooltip.bottom="'Switch Database'"
            class="btn btn-ghost btn-sm text-white"
            title="Switch Database"
            @click="databaseSwitchRef?.openDatabaseSwitcher()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
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
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
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
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
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
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
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
              id="Capa_1"
              fill="#fff"
              class="size-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 60 60"
              xml:space="preserve"
            >
              <g
                id="SVGRepo_bgCarrier"
                stroke-width="0"
              />
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <g id="SVGRepo_iconCarrier">
                <path
                  d="M53,41V29H31V19h7V3H22v16h7v10H7v12H0v16h16V41H9V31h20v10h-7v16h16V41h-7V31h20v10h-7v16h16V41H53z M24,5h12v12H24V5z M14,55H2V43h12V55z M36,55H24V43h12V55z M58,55H46V43h12V55z"
                />
              </g>
            </svg>
          </button>

          <button
            v-tooltip.bottom="'Project Logs'"
            class="btn btn-ghost btn-sm"
            title="Project Logs"
            @click="showProjectLogs = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </button>

          <button
            v-tooltip.bottom="'Migration UI'"
            class="btn btn-ghost btn-sm text-white"
            title="Run Artisan Commands"
            @click="showArtisanCommands = true"
          >
            <svg
              class="size-5"
              viewBox="0 0 64 64"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>db-tables-swap</title>
              <desc>Created with Sketch.</desc>
              <defs />
              <g
                id="64px-Line"
                stroke="none"
                stroke-width="1"
                fill="currentColor"
                fill-rule="evenodd"
              >
                <g id="db-tables-swap" />
                <path
                  id="Shape"
                  d="M29,16 C29.552,16 30,15.552 30,15 C30,14.448 29.552,14 29,14 C21.832,14 16,19.832 16,27 L16,30.586 L13.707,28.293 C13.316,27.902 12.684,27.902 12.293,28.293 C11.902,28.684 11.902,29.316 12.293,29.707 L16.292,33.707 C16.384,33.799 16.495,33.873 16.618,33.923 C16.74,33.974 16.87,34 17,34 C17.13,34 17.26,33.974 17.382,33.923 C17.505,33.872 17.615,33.799 17.708,33.707 L21.707,29.707 C22.098,29.316 22.098,28.684 21.707,28.293 C21.316,27.902 20.684,27.902 20.293,28.293 L18,30.586 L18,27 C18,20.935 22.935,16 29,16 L29,16 Z"
                  fill="currentColor"
                />
                <path
                  id="Shape"
                  d="M35,48 C34.448,48 34,48.447 34,49 C34,49.553 34.448,50 35,50 C42.168,50 48,44.168 48,37 L48,33.414 L50.293,35.707 C50.488,35.902 50.744,36 51,36 C51.256,36 51.512,35.902 51.707,35.707 C52.098,35.316 52.098,34.684 51.707,34.293 L47.707,30.293 C47.615,30.201 47.504,30.127 47.382,30.077 C47.138,29.976 46.862,29.976 46.618,30.077 C46.496,30.128 46.385,30.201 46.293,30.293 L42.293,34.293 C41.902,34.684 41.902,35.316 42.293,35.707 C42.684,36.098 43.316,36.098 43.707,35.707 L46,33.414 L46,37 C46,43.065 41.065,48 35,48 L35,48 Z"
                  fill="currentColor"
                />
                <path
                  id="Shape"
                  d="M59,6 L35,6 C34.448,6 34,6.448 34,7 L34,25 C34,25.552 34.448,26 35,26 L59,26 C59.552,26 60,25.552 60,25 L60,7 C60,6.448 59.552,6 59,6 L59,6 Z M44,18 L44,14 L50,14 L50,18 L44,18 L44,18 Z M50,20 L50,24 L44,24 L44,20 L50,20 L50,20 Z M36,14 L42,14 L42,18 L36,18 L36,14 L36,14 Z M52,14 L58,14 L58,18 L52,18 L52,14 L52,14 Z M58,8 L58,12 L36,12 L36,8 L58,8 L58,8 Z M36,20 L42,20 L42,24 L36,24 L36,20 L36,20 Z M52,24 L52,20 L58,20 L58,24 L52,24 L52,24 Z"
                  fill="currentColor"
                />
                <path
                  id="Shape"
                  d="M5,58 L29,58 C29.552,58 30,57.553 30,57 L30,39 C30,38.447 29.552,38 29,38 L5,38 C4.448,38 4,38.447 4,39 L4,57 C4,57.553 4.448,58 5,58 L5,58 Z M20,46 L20,50 L14,50 L14,46 L20,46 L20,46 Z M28,46 L28,50 L22,50 L22,46 L28,46 L28,46 Z M20,52 L20,56 L14,56 L14,52 L20,52 L20,52 Z M12,50 L6,50 L6,46 L12,46 L12,50 L12,50 Z M6,52 L12,52 L12,56 L6,56 L6,52 L6,52 Z M22,56 L22,52 L28,52 L28,56 L22,56 L22,56 Z M28,40 L28,44 L6,44 L6,40 L28,40 L28,40 Z"
                  fill="currentColor"
                />
              </g>
            </svg>
          </button>

          <button
            v-tooltip.bottom="'Laravel Commands'"
            class="btn btn-ghost btn-sm text-white"
            title="Laravel Commands"
            @click="showLaravelCommands = true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="size-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </button>

          <!-- Redis Manager Button -->
          <button
            :disabled="!isRedisConnection && !isRedisAvailable"
            :class="{ 'opacity-20': !isRedisConnection && !isRedisAvailable }"
            v-tooltip.bottom="'Redis Manager'"
            class="btn btn-ghost btn-sm text-white"
            title="Redis Manager"
            @click="showRedisManager = true"
          >
            <svg
              class="size-5"
              fill="#fff"
              viewBox="0 -2 28 28"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g
                id="SVGRepo_bgCarrier"
                stroke-width="0"
              ></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <path
                  d="m27.994 14.729c-.012.267-.365.566-1.091.945-1.495.778-9.236 3.967-10.883 4.821-.589.419-1.324.67-2.116.67-.641 0-1.243-.164-1.768-.452l.019.01c-1.304-.622-9.539-3.95-11.023-4.659-.741-.35-1.119-.653-1.132-.933v2.83c0 .282.39.583 1.132.933 1.484.709 9.722 4.037 11.023 4.659.504.277 1.105.44 1.744.44.795 0 1.531-.252 2.132-.681l-.011.008c1.647-.859 9.388-4.041 10.883-4.821.76-.396 1.096-.7 1.096-.982s0-2.791 0-2.791z"
                ></path>
                <path
                  d="m27.992 10.115c-.013.267-.365.565-1.09.944-1.495.778-9.236 3.967-10.883 4.821-.59.421-1.326.672-2.121.672-.639 0-1.24-.163-1.763-.449l.019.01c-1.304-.627-9.539-3.955-11.023-4.664-.741-.35-1.119-.653-1.132-.933v2.83c0 .282.39.583 1.132.933 1.484.709 9.721 4.037 11.023 4.659.506.278 1.108.442 1.749.442.793 0 1.527-.251 2.128-.677l-.011.008c1.647-.859 9.388-4.043 10.883-4.821.76-.397 1.096-.7 1.096-.984s0-2.791 0-2.791z"
                ></path>
                <path
                  d="m27.992 5.329c.014-.285-.358-.534-1.107-.81-1.451-.533-9.152-3.596-10.624-4.136-.528-.242-1.144-.383-1.794-.383-.734 0-1.426.18-2.035.498l.024-.012c-1.731.622-9.924 3.835-11.381 4.405-.729.287-1.086.552-1.073.834v2.83c0 .282.39.583 1.132.933 1.484.709 9.721 4.038 11.023 4.66.504.277 1.105.439 1.744.439.795 0 1.531-.252 2.133-.68l-.011.008c1.647-.859 9.388-4.043 10.883-4.821.76-.397 1.096-.7 1.096-.984s0-2.791 0-2.791h-.009zm-17.967 2.684 6.488-.996-1.96 2.874zm14.351-2.588-4.253 1.68-3.835-1.523 4.246-1.679 3.838 1.517zm-11.265-2.785-.628-1.157 1.958.765 1.846-.604-.499 1.196 1.881.7-2.426.252-.543 1.311-.879-1.457-2.8-.252 2.091-.754zm-4.827 1.632c1.916 0 3.467.602 3.467 1.344s-1.559 1.344-3.467 1.344-3.474-.603-3.474-1.344 1.553-1.344 3.474-1.344z"
                ></path>
              </g>
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
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
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

      <div class="flex-1 bg-base-100 overflow-hidden">
        <div
          v-if="!activeTab"
          class="flex items-center justify-center h-full text-gray-500"
        >
          <div class="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-12 h-12 mx-auto mb-4 text-gray-400"
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

        <keep-alive>
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

    <footer class="bg-neutral px-4 py-1 text-xs text-gray-400 border-t border-black/20">
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
    <div class="modal-box w-11/12 max-w-5xl max-h-[90vh]">
      <h3 class="font-bold text-lg mb-4">All Tables Models Data</h3>
      <div class="mockup-code bg-neutral mb-4 h-[60vh] overflow-auto">
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
import { computed, inject, onMounted, ref, markRaw, nextTick, watch, onBeforeMount } from "vue";
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
const isRedisAvailable = ref(false);
const isRedisConnection = computed(() => !!connection.value?.redis);

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

onBeforeMount(() => {
  loadSidebarWidth();
});

onMounted(async () => {
  try {
    await tabsStore.loadSavedTabs();

    await connectionsStore.loadConnections();

    if (!connection.value) {
      connectionError.value = true;
      connectionErrorMessage.value = "Connection not found";
      return;
    }

    const connectionValid = await testConnection();
    if (!connectionValid) {
      return;
    }

    showAlert(`Connected to ${connection.value.name}`, "success");
    await databaseStore.loadTables(connectionId.value);

    await checkRedisAvailability();

    databaseStore.clearTableRecordCounts();

    window.addEventListener("resize", mainTabsRef.value?.checkScrollPosition);

    await nextTick(() => {
      mainTabsRef.value?.scrollToActiveTab();
      mainTabsRef.value?.checkScrollPosition();
    });

    document.querySelector(".flex.flex-col.h-full")?.focus();
  } catch (error) {
    console.error(error);
    connectionError.value = true;
    connectionErrorMessage.value = error.message || "Unknown error occurred";
  }
});

function getConnectionColor(type) {
  switch (type) {
    case "mysql":
      return "bg-orange-500";
    case "redis":
      return "bg-red-600";
    case "sqlite":
      return "bg-purple-600";
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
