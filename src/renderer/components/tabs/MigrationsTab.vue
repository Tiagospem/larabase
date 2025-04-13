<template>
  <div class="h-full flex flex-col">
    <div class="bg-base-200 p-2 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button class="btn btn-sm btn-ghost" @click="loadMigrations">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      
      <div v-else-if="loadError" class="flex items-center justify-center h-full text-error">
        <div class="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
            stroke="currentColor" class="w-12 h-12 mx-auto mb-4">
            <path stroke-linecap="round" stroke-linejoin="round" 
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p>{{ loadError }}</p>
          <button class="btn btn-sm btn-primary mt-4" @click="loadMigrations">Try again</button>
        </div>
      </div>
      
      <div v-else class="p-4">
        <div v-if="migrations.length === 0" class="flex items-center justify-center h-full text-gray-500">
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
              stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400">
              <path stroke-linecap="round" stroke-linejoin="round" 
                d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
            </svg>
            <p>No migrations found for this table</p>
            <button class="btn btn-sm btn-ghost mt-4" @click="loadMigrations">Reload</button>
          </div>
        </div>
        
        <div v-else>
          <div class="collapse-group">
            <div v-for="migration in migrations" :key="migration.id" 
                 class="collapse collapse-arrow bg-base-200 mb-2">
              <input type="checkbox" />
              <div class="collapse-title font-medium flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" :class="getMigrationStatusDotClass(migration.status)"></div>
                  <span>{{ migration.name }}</span>
                </div>
                <div class="badge badge-sm" :class="getMigrationStatusClass(migration.status)">
                  {{ migration.status }}
                </div>
              </div>
              <div class="collapse-content">
                <div class="text-sm text-gray-400 mb-2">{{ migration.created_at }}</div>
                <div class="divider my-2"></div>
                <div>
                  <h4 class="font-medium mb-2">Changes</h4>
                  <div class="space-y-2">
                    <div v-for="(action, actionIndex) in migration.actions" :key="actionIndex" 
                      class="bg-base-300 p-2 rounded-md">
                      <div class="flex items-center space-x-2">
                        <div class="badge badge-ghost badge-sm">{{ action.type }}</div>
                        <span class="text-sm">{{ action.description }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="mt-4 flex justify-end">
                  <button class="btn btn-sm btn-ghost" @click="viewMigrationCode(migration)">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
                      stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                    View Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="migrations.length > 0" class="bg-base-200 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400">
      <div>{{ tableName }} | {{ migrations.length }} migrations</div>
      <div>
        <span>Latest: {{ migrations[0].created_at }}</span>
      </div>
    </div>
    
    <!-- Modal for viewing migration code -->
    <div v-if="selectedMigration" class="modal modal-open">
      <div class="modal-box w-11/12 max-w-5xl">
        <h3 class="font-bold text-lg mb-4">Migration: {{ selectedMigration.name }}</h3>
        <div class="mockup-code bg-neutral mb-4">
          <pre><code>{{ selectedMigration.code }}</code></pre>
        </div>
        <div class="modal-action">
          <button class="btn" @click="selectedMigration = null">Close</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="selectedMigration = null"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useDatabaseStore } from '@/store/database';

const showAlert = inject('showAlert');

const props = defineProps({
  connectionId: {
    type: Number,
    required: true
  },
  tableName: {
    type: String,
    required: true
  },
  onLoad: {
    type: Function,
    required: true
  }
});

// State
const isLoading = ref(true);
const migrations = ref([]);
const loadError = ref(null);
const selectedMigration = ref(null);

const databaseStore = useDatabaseStore();

// Methods
function getMigrationStatusClass(status) {
  return 'badge-ghost';
}

function getMigrationStatusDotClass(status) {
  switch (status) {
    case 'APPLIED':
      return 'bg-gray-400';
    case 'PENDING':
      return 'bg-gray-300';
    case 'FAILED':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
}

function getMigrationStatusLineClass(status) {
  return 'bg-gray-700';
}

function getActionTypeClass(type) {
  return 'badge-ghost';
}

function viewMigrationCode(migration) {
  selectedMigration.value = migration;
}

async function loadMigrations() {
  isLoading.value = true;
  loadError.value = null;
  
  try {
    // In a real application, implement this method in the database store
    // For now, we'll use mock data since we don't have the actual implementation
    
    // Mock data - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
    
    // This would be the actual API call in a real application:
    // const migrations = await databaseStore.getTableMigrations(props.connectionId, props.tableName);
    
    // Mock migrations data
    const mockMigrations = [
      {
        id: 1,
        name: '2023_10_15_create_users_table',
        status: 'APPLIED',
        created_at: 'October 15, 2023 - 14:30',
        actions: [
          {
            type: 'CREATE',
            description: 'Created users table'
          }
        ],
        code: `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up()\n    {\n        Schema::create('users', function (Blueprint $table) {\n            $table->id();\n            $table->string('name');\n            $table->string('email')->unique();\n            $table->string('password');\n            $table->timestamps();\n        });\n    }\n\n    public function down()\n    {\n        Schema::dropIfExists('users');\n    }\n};`
      },
      {
        id: 2,
        name: '2023_10_20_add_user_type_id_to_users',
        status: 'APPLIED',
        created_at: 'October 20, 2023 - 09:15',
        actions: [
          {
            type: 'ALTER',
            description: 'Modified users table'
          },
          {
            type: 'ADD',
            description: 'Added user_type_id column'
          }
        ],
        code: `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up()\n    {\n        Schema::table('users', function (Blueprint $table) {\n            $table->foreignId('user_type_id')->nullable()->constrained();\n        });\n    }\n\n    public function down()\n    {\n        Schema::table('users', function (Blueprint $table) {\n            $table->dropForeign(['user_type_id']);\n            $table->dropColumn('user_type_id');\n        });\n    }\n};`
      },
      {
        id: 3,
        name: '2023_11_05_add_avatar_to_users',
        status: 'PENDING',
        created_at: 'November 5, 2023 - 16:45',
        actions: [
          {
            type: 'ALTER',
            description: 'Modifying users table'
          },
          {
            type: 'ADD',
            description: 'Adding avatar column'
          }
        ],
        code: `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n    public function up()\n    {\n        Schema::table('users', function (Blueprint $table) {\n            $table->string('avatar')->nullable();\n        });\n    }\n\n    public function down()\n    {\n        Schema::table('users', function (Blueprint $table) {\n            $table->dropColumn('avatar');\n        });\n    }\n};`
      }
    ];
    
    migrations.value = mockMigrations;
    
    // Notify parent component
    props.onLoad({
      migrationCount: migrations.value.length,
      pendingMigrations: migrations.value.filter(m => m.status === 'PENDING').length
    });
    
  } catch (error) {
    loadError.value = 'Failed to load migrations: ' + (error.message || 'Unknown error');
    showAlert(`Error loading migrations: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

// Lifecycle
onMounted(() => {
  loadMigrations();
});
</script>

<style scoped>
.timeline-box {
  width: 100%;
  max-width: none;
}

/* Custom timeline styling */
.timeline-vertical::before {
  left: 50%;
}

.timeline-start {
  place-items: end;
  grid-column-start: 1;
  grid-column-end: 5;
  text-align: left;
}

.timeline-middle {
  grid-column-start: 5;
  grid-column-end: 7;
}

.timeline-end {
  grid-column-start: 7;
  grid-column-end: 11;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 640px) {
  .timeline-box {
    width: calc(100% - 1rem);
  }
}
</style> 