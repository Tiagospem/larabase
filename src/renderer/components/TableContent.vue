<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-300 px-2 py-2 border-b border-neutral flex items-center">
      <div class="flex gap-4">
        <a
          v-for="tab in contentTabs"
          :key="tab.id"
          class="flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors text-sm"
          :class="{
            'text-white': activeContentTab === tab.id,
            'text-gray-500 hover:text-gray-300': activeContentTab !== tab.id,
            'pointer-events-none opacity-20 animate-pulse': tablesStore.isLoading
          }"
          @click="switchContentTab(tab.id)"
        >
          {{ tab.label }}
        </a>
      </div>
    </div>

    <keep-alive>
      <component
        :is="currentTabComponent"
        v-bind="currentTabProps"
      />
    </keep-alive>
  </div>
</template>

<script setup>
import { ref, computed, markRaw, defineAsyncComponent, onActivated } from "vue";
import { useTablesStore } from "@/store/tables";

const DataTab = markRaw(defineAsyncComponent(() => import("./tabs/DataTab.vue")));
const StructureTab = markRaw(defineAsyncComponent(() => import("./tabs/StructureTab.vue")));
const IndexesTab = markRaw(defineAsyncComponent(() => import("./tabs/IndexesTab.vue")));
const ForeignKeysTab = markRaw(defineAsyncComponent(() => import("./tabs/ForeignKeysTab.vue")));
const MigrationsTab = markRaw(defineAsyncComponent(() => import("./tabs/MigrationsTab.vue")));
const ModelTab = markRaw(defineAsyncComponent(() => import("./tabs/ModelTab.vue")));
const FactoryTab = markRaw(defineAsyncComponent(() => import("./tabs/FactoryTab.vue")));

const tablesStore = useTablesStore();

// Explicitly name this component for keep-alive caching
defineOptions({
  name: "TableContent"
});

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  filter: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["update-tab-data", "open-tab", "open-database-switcher"]);

const activeContentTab = ref("data");
const tabsLoaded = ref({
  data: false,
  structure: false,
  indexes: false,
  foreignKeys: false,
  migrations: false,
  model: false,
  factory: false
});

const contentTabs = [
  { id: "data", label: "Data" },
  { id: "structure", label: "Structure" },
  { id: "indexes", label: "Indexes" },
  { id: "foreignKeys", label: "Foreign Keys" },
  { id: "migrations", label: "Migrations" },
  { id: "model", label: "Model" },
  { id: "factory", label: "Factory" }
];

const currentTabComponent = computed(() => {
  switch (activeContentTab.value) {
    case "data":
      return DataTab;
    case "structure":
      return StructureTab;
    case "indexes":
      return IndexesTab;
    case "foreignKeys":
      return ForeignKeysTab;
    case "migrations":
      return MigrationsTab;
    case "model":
      return ModelTab;
    case "factory":
      return FactoryTab;
    default:
      return DataTab;
  }
});

const currentTabProps = computed(() => {
  const baseProps = {
    connectionId: props.connectionId,
    tableName: props.tableName,
    onLoad: (data) => handleTabData(activeContentTab.value, data),
    onOpenTab: (tabData) => emit("open-tab", tabData),
    "onOpen-database-switcher": (connectionId) => emit("open-database-switcher", connectionId)
  };

  if (activeContentTab.value === "data" && props.filter) {
    console.log("Passando filtro para DataTab:", props.filter);
    baseProps.initialFilter = props.filter;
  }

  return baseProps;
});

function switchContentTab(tabId) {
  activeContentTab.value = tabId;

  emit("update-tab-data", props.tableName, {
    activeContentTab: tabId
  });
}

function handleTabData(tabId, data) {
  tabsLoaded.value[tabId] = true;

  if (tabId === "data") {
    emit("update-tab-data", props.tableName, {
      columns: data.columns,
      rowCount: data.rowCount,
      activeContentTab: activeContentTab.value
    });
  }
}

onActivated(() => {
  // When component is reactivated from cache, ensure the active tab data is refreshed if needed
  if (activeContentTab.value === "data") {
    // Signal that this tab is being re-activated without full reload
    emit("update-tab-data", props.tableName, {
      activeContentTab: activeContentTab.value
    });
  }
});
</script>
