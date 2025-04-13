<template>
  <div class="h-full flex flex-col">
    <!-- Tabs de conteúdo -->
    <div class="bg-base-300 px-2 pt-1 border-b border-gray-800 flex items-center">
      <div class="tabs tabs-boxed bg-transparent gap-1">
        <a 
          v-for="tab in contentTabs" 
          :key="tab.id"
          class="tab transition-all duration-200 px-4 rounded-t-md" 
          :class="{ 'tab-active bg-base-100 border-t-2 border-primary': activeContentTab === tab.id }"
          @click="switchContentTab(tab.id)"
        >
          <span class="flex items-center gap-1">
            <component :is="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </span>
        </a>
      </div>
    </div>
    
    <!-- Conteúdo de dados da tabela -->
    <keep-alive>
      <component :is="currentTabComponent" v-bind="currentTabProps"></component>
    </keep-alive>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, markRaw, defineAsyncComponent } from 'vue';
import { useDatabaseStore } from '@/store/database';

// Componentes das tabs - carregamento assíncrono para melhor performance
const DataTab = markRaw(defineAsyncComponent(() => import('./tabs/DataTab.vue')));
const StructureTab = markRaw(defineAsyncComponent(() => import('./tabs/StructureTab.vue')));
const IndexesTab = markRaw(defineAsyncComponent(() => import('./tabs/IndexesTab.vue')));
const ForeignKeysTab = markRaw(defineAsyncComponent(() => import('./tabs/ForeignKeysTab.vue')));
const MigrationsTab = markRaw(defineAsyncComponent(() => import('./tabs/MigrationsTab.vue')));

// Ícones para as tabs
const TableIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`
});

const StructureIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`
});

const IndexIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`
});

const KeyIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`
});

const MigrationIcon = markRaw({
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`
});

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: Number,
    required: true
  },
  tableName: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update-tab-data']);

// Estado para as tabs de conteúdo
const activeContentTab = ref('data');
const tabsLoaded = ref({
  data: false,
  structure: false,
  indexes: false,
  foreignKeys: false,
  migrations: false
});

// Definição das tabs disponíveis
const contentTabs = [
  { id: 'data', label: 'Data', icon: TableIcon },
  { id: 'structure', label: 'Structure', icon: StructureIcon },
  { id: 'indexes', label: 'Indexes', icon: IndexIcon },
  { id: 'foreignKeys', label: 'Foreign Keys', icon: KeyIcon },
  { id: 'migrations', label: 'Migrations', icon: MigrationIcon }
];

// Componente atual baseado na tab ativa
const currentTabComponent = computed(() => {
  switch (activeContentTab.value) {
    case 'data': return DataTab;
    case 'structure': return StructureTab;
    case 'indexes': return IndexesTab;
    case 'foreignKeys': return ForeignKeysTab;
    case 'migrations': return MigrationsTab;
    default: return DataTab;
  }
});

// Props para passar ao componente da tab ativa
const currentTabProps = computed(() => {
  return {
    connectionId: props.connectionId,
    tableName: props.tableName,
    onLoad: (data) => handleTabData(activeContentTab.value, data)
  };
});

// Trocar entre as tabs de conteúdo
function switchContentTab(tabId) {
  activeContentTab.value = tabId;
  
  // Emitir evento para atualizar o estado na tab pai
  emit('update-tab-data', props.tableName, {
    activeContentTab: tabId
  });
}

// Gerenciar dados carregados em cada tab
function handleTabData(tabId, data) {
  tabsLoaded.value[tabId] = true;
  
  // Emitir dados para atualizar a tab pai
  if (tabId === 'data') {
    emit('update-tab-data', props.tableName, {
      columns: data.columns,
      rowCount: data.rowCount,
      activeContentTab: activeContentTab.value
    });
  }
}

// Inicialização
onMounted(() => {
  // A DataTab será carregada diretamente pelo componente filho
});
</script>

<style>
/* Estilos gerais já estavam definidos anteriormente */
</style> 