<template>
  <div
    v-if="isModal"
    class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
  >
    <div class="performance-monitor text-sm rounded-lg p-3 bg-base-300 text-base-content relative max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-bold">Performance Monitor</h3>
        <div class="flex gap-1">
          <button
            @click="refresh"
            class="btn btn-xs btn-ghost"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            v-if="isModal"
            @click="$emit('close')"
            class="btn btn-xs btn-ghost"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="stats shadow w-full">
        <div class="stat">
          <div class="stat-title">Memory</div>
          <div class="stat-value text-lg">{{ formatMemory(memoryUsage.heapUsed) }}</div>
          <div class="stat-desc">{{ formatMemory(memoryUsage.heapTotal) }} total</div>
        </div>

        <div class="stat">
          <div class="stat-title">Listeners</div>
          <div class="stat-value text-lg">{{ listenerStats.totalListeners }}</div>
          <div class="stat-desc">{{ listenerStats.totalChannels }} channels</div>
        </div>
      </div>

      <div class="mt-2">
        <div class="collapse collapse-arrow">
          <input type="checkbox" />
          <div class="collapse-title font-medium text-xs">Dynamic Channels ({{ listenerStats.dynamicChannels.length }})</div>
          <div class="collapse-content">
            <div class="overflow-x-auto max-h-32">
              <ul class="list-disc pl-4 text-xs">
                <li
                  v-for="(channel, i) in listenerStats.dynamicChannels"
                  :key="i"
                >
                  {{ channel }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="collapse collapse-arrow">
          <input type="checkbox" />
          <div class="collapse-title font-medium text-xs">Active DB Connections ({{ listenerStats.activeMonitoringConnections.length }})</div>
          <div class="collapse-content">
            <div class="overflow-x-auto max-h-32">
              <ul class="list-disc pl-4 text-xs">
                <li
                  v-for="(conn, i) in listenerStats.activeMonitoringConnections"
                  :key="i"
                >
                  {{ conn }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Add detailed listener breakdown -->
        <div class="collapse collapse-arrow">
          <input type="checkbox" />
          <div class="collapse-title font-medium text-xs">All Channels Detail</div>
          <div class="collapse-content">
            <div class="overflow-x-auto max-h-32">
              <table class="table table-xs w-full">
                <thead>
                  <tr>
                    <th class="text-xs">Channel</th>
                    <th class="text-xs text-right">Listeners</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(count, channel) in listenerStats.channelBreakdown"
                    :key="channel"
                    class="hover:bg-base-200"
                  >
                    <td class="text-xs truncate max-w-36">{{ channel }}</td>
                    <td class="text-xs text-right">
                      <span class="badge badge-sm">{{ count }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Add detailed Event Emitter listeners -->
        <div class="collapse collapse-arrow">
          <input type="checkbox" />
          <div class="collapse-title font-medium text-xs">EventEmitter Listeners</div>
          <div class="collapse-content">
            <div class="overflow-x-auto max-h-32">
              <table class="table table-xs w-full">
                <thead>
                  <tr>
                    <th class="text-xs">Emitter</th>
                    <th class="text-xs text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, i) in listenerStats.eventEmitterStats"
                    :key="i"
                    class="hover:bg-base-200"
                  >
                    <td class="text-xs truncate max-w-36">{{ item.name }}</td>
                    <td class="text-xs text-right">
                      <span
                        class="badge badge-sm"
                        :class="{ 'badge-warning': item.count > 8, 'badge-error': item.count >= 10 }"
                        >{{ item.count }}</span
                      >
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Add memory leak warning section -->
        <div
          v-if="listenerStats.potentialLeaks && listenerStats.potentialLeaks.length > 0"
          class="alert alert-warning my-2 p-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <div class="font-bold text-xs">Potential Memory Leaks</div>
            <div class="text-xs mt-1">
              <ul class="list-disc pl-4">
                <li
                  v-for="(leak, i) in listenerStats.potentialLeaks.slice(0, 3)"
                  :key="i"
                >
                  {{ leak.channel }}: {{ leak.currentCount }} listeners
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Add historical trend graph -->
        <div class="collapse collapse-arrow mt-2">
          <input type="checkbox" />
          <div class="collapse-title font-medium text-xs">Listener History</div>
          <div class="collapse-content">
            <div class="h-24 mt-2 relative bg-base-200 rounded">
              <div
                v-if="listenerStats.history && listenerStats.history.length > 0"
                class="absolute inset-0 flex items-end"
              >
                <div
                  v-for="(point, i) in listenerStats.history"
                  :key="i"
                  class="h-full flex-1 flex flex-col justify-end items-center"
                  :title="`${new Date(point.timestamp).toLocaleTimeString()}: ${point.count} listeners`"
                >
                  <div
                    class="bg-primary w-3"
                    :style="`height: ${calculateBarHeight(point.count)}%`"
                  ></div>
                </div>
              </div>
              <div
                v-else
                class="flex h-full items-center justify-center text-xs opacity-50"
              >
                Not enough data collected
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between gap-2 mt-3">
        <button
          @click="cleanupListeners"
          class="btn btn-xs btn-warning flex-1"
        >
          Cleanup
        </button>
        <button
          @click="forceGc"
          class="btn btn-xs btn-secondary flex-1"
        >
          Force GC
        </button>
        <button
          @click="fixListenerLimits"
          class="btn btn-xs btn-error flex-1"
          title="Fix MaxListenersExceededWarning by increasing the listener limit"
        >
          Fix Limits
        </button>
      </div>

      <div class="text-xs mt-2 opacity-70">Last updated: {{ new Date().toLocaleTimeString() }}</div>
    </div>
  </div>
  <div
    v-else
    class="performance-monitor text-sm rounded-lg p-3 bg-base-300 text-base-content"
  >
    <div class="flex justify-between items-center mb-2">
      <h3 class="font-bold">Performance Monitor</h3>
      <button
        @click="refresh"
        class="btn btn-xs btn-ghost"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>

    <div class="stats shadow w-full">
      <div class="stat">
        <div class="stat-title">Memory</div>
        <div class="stat-value text-lg">{{ formatMemory(memoryUsage.heapUsed) }}</div>
        <div class="stat-desc">{{ formatMemory(memoryUsage.heapTotal) }} total</div>
      </div>

      <div class="stat">
        <div class="stat-title">Listeners</div>
        <div class="stat-value text-lg">{{ listenerStats.totalListeners }}</div>
        <div class="stat-desc">{{ listenerStats.totalChannels }} channels</div>
      </div>
    </div>

    <div class="mt-2">
      <div class="collapse collapse-arrow">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-xs">Dynamic Channels ({{ listenerStats.dynamicChannels.length }})</div>
        <div class="collapse-content">
          <div class="overflow-x-auto max-h-32">
            <ul class="list-disc pl-4 text-xs">
              <li
                v-for="(channel, i) in listenerStats.dynamicChannels"
                :key="i"
              >
                {{ channel }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="collapse collapse-arrow">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-xs">Active DB Connections ({{ listenerStats.activeMonitoringConnections.length }})</div>
        <div class="collapse-content">
          <div class="overflow-x-auto max-h-32">
            <ul class="list-disc pl-4 text-xs">
              <li
                v-for="(conn, i) in listenerStats.activeMonitoringConnections"
                :key="i"
              >
                {{ conn }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Add detailed listener breakdown -->
      <div class="collapse collapse-arrow">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-xs">All Channels Detail</div>
        <div class="collapse-content">
          <div class="overflow-x-auto max-h-32">
            <table class="table table-xs w-full">
              <thead>
                <tr>
                  <th class="text-xs">Channel</th>
                  <th class="text-xs text-right">Listeners</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(count, channel) in listenerStats.channelBreakdown"
                  :key="channel"
                  class="hover:bg-base-200"
                >
                  <td class="text-xs truncate max-w-36">{{ channel }}</td>
                  <td class="text-xs text-right">
                    <span class="badge badge-sm">{{ count }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add detailed Event Emitter listeners -->
      <div class="collapse collapse-arrow">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-xs">EventEmitter Listeners</div>
        <div class="collapse-content">
          <div class="overflow-x-auto max-h-32">
            <table class="table table-xs w-full">
              <thead>
                <tr>
                  <th class="text-xs">Emitter</th>
                  <th class="text-xs text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, i) in listenerStats.eventEmitterStats"
                  :key="i"
                  class="hover:bg-base-200"
                >
                  <td class="text-xs truncate max-w-36">{{ item.name }}</td>
                  <td class="text-xs text-right">
                    <span
                      class="badge badge-sm"
                      :class="{ 'badge-warning': item.count > 8, 'badge-error': item.count >= 10 }"
                      >{{ item.count }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add memory leak warning section -->
      <div
        v-if="listenerStats.potentialLeaks && listenerStats.potentialLeaks.length > 0"
        class="alert alert-warning my-2 p-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <div class="font-bold text-xs">Potential Memory Leaks</div>
          <div class="text-xs mt-1">
            <ul class="list-disc pl-4">
              <li
                v-for="(leak, i) in listenerStats.potentialLeaks.slice(0, 3)"
                :key="i"
              >
                {{ leak.channel }}: {{ leak.currentCount }} listeners
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Add historical trend graph -->
      <div class="collapse collapse-arrow mt-2">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-xs">Listener History</div>
        <div class="collapse-content">
          <div class="h-24 mt-2 relative bg-base-200 rounded">
            <div
              v-if="listenerStats.history && listenerStats.history.length > 0"
              class="absolute inset-0 flex items-end"
            >
              <div
                v-for="(point, i) in listenerStats.history"
                :key="i"
                class="h-full flex-1 flex flex-col justify-end items-center"
                :title="`${new Date(point.timestamp).toLocaleTimeString()}: ${point.count} listeners`"
              >
                <div
                  class="bg-primary w-3"
                  :style="`height: ${calculateBarHeight(point.count)}%`"
                ></div>
              </div>
            </div>
            <div
              v-else
              class="flex h-full items-center justify-center text-xs opacity-50"
            >
              Not enough data collected
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-between gap-2 mt-3">
      <button
        @click="cleanupListeners"
        class="btn btn-xs btn-warning flex-1"
      >
        Cleanup
      </button>
      <button
        @click="forceGc"
        class="btn btn-xs btn-secondary flex-1"
      >
        Force GC
      </button>
      <button
        @click="fixListenerLimits"
        class="btn btn-xs btn-error flex-1"
        title="Fix MaxListenersExceededWarning by increasing the listener limit"
      >
        Fix Limits
      </button>
    </div>

    <div class="text-xs mt-2 opacity-70">Last updated: {{ new Date().toLocaleTimeString() }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
  isModal: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close"]);

const memoryUsage = ref({
  heapUsed: 0,
  heapTotal: 0
});

const listenerStats = ref({
  totalChannels: 0,
  totalListeners: 0,
  dynamicChannels: [],
  activeMonitoringConnections: [],
  channelBreakdown: {},
  eventEmitterStats: [],
  potentialLeaks: [],
  history: []
});

let refreshInterval = null;

function formatMemory(bytes) {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
  else return (bytes / 1048576).toFixed(2) + " MB";
}

async function refresh() {
  if (window.api && window.api.getListenerStats) {
    try {
      listenerStats.value = await window.api.getListenerStats();
    } catch (error) {
      console.error("Failed to get listener stats:", error);
    }
  }

  try {
    const performance = window.performance || {};
    const memory = performance.memory || {};

    memoryUsage.value = {
      heapUsed: memory.usedJSHeapSize || 0,
      heapTotal: memory.totalJSHeapSize || 0
    };
  } catch (error) {
    console.error("Failed to get memory stats:", error);
  }
}

function cleanupListeners() {
  if (window.__cleanupListeners) {
    try {
      const result = window.__cleanupListeners();
      console.log("Cleanup result:", result);
      refresh();
    } catch (error) {
      console.error("Failed to clean up listeners:", error);
    }
  } else {
    console.warn("Cleanup function not available");
    if (window.api && window.api.stopMonitoringDatabaseOperations) {
      listenerStats.value.activeMonitoringConnections.forEach((connId) => {
        try {
          window.api.stopMonitoringDatabaseOperations(`db-operation-${connId}`, true).catch((err) => console.error("Error stopping monitoring:", err));
        } catch (error) {
          // Ignore errors
        }
      });
    }
    refresh();
  }
}

function forceGc() {
  if (window.api && window.api.triggerGarbageCollection) {
    try {
      const result = window.api.triggerGarbageCollection();
      if (result && typeof result.then === "function") {
        // It's a Promise
        result
          .then((response) => {
            if (response && response.success) {
              console.log("Garbage collection triggered successfully");
            } else {
              console.warn("Garbage collection failed:", response ? response.error : "Unknown error");
            }
            setTimeout(refresh, 500);
          })
          .catch((error) => {
            console.error("Failed to trigger garbage collection:", error);
          });
      } else {
        console.log("Garbage collection request sent");
        setTimeout(refresh, 500);
      }
    } catch (error) {
      console.error("Failed to force garbage collection:", error);
    }
  } else if (window.gc) {
    try {
      window.gc();
      console.log("Garbage collection requested");

      setTimeout(refresh, 500);
    } catch (error) {
      console.error("Failed to force garbage collection:", error);
    }
  } else {
    console.warn("Garbage collection not available");
    alert("Garbage collection is not available. Try restarting the app with the --expose-gc flag.");
  }
}

function calculateBarHeight(count) {
  const max = Math.max(...(listenerStats.value.history || []).map((h) => h.count));
  if (max === 0) return 0;
  return Math.min(Math.round((count / max) * 100), 100);
}

function fixListenerLimits() {
  if (window.api && window.api.fixMaxListenersWarning) {
    try {
      const result = window.api.fixMaxListenersWarning();

      if (result && typeof result.then === "function") {
        result
          .then((response) => {
            if (response) {
              console.log("Fixed max listeners warnings");
            } else {
              console.warn("Could not fix max listeners warnings");
            }
            refresh();
          })
          .catch((error) => {
            console.error("Error in fixMaxListenersWarning promise:", error);
          });
      } else {
        if (result === true) {
          console.log("Fixed max listeners warnings");
        } else {
          console.warn("Could not fix max listeners warnings");
        }
        refresh();
      }
    } catch (error) {
      console.error("Error fixing listener limits:", error);
    }
  } else {
    console.warn("fixMaxListenersWarning not available");
    alert("The fix listener limits function is not available in this version.");
  }
}

onMounted(() => {
  refresh();

  refreshInterval = setInterval(refresh, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});
</script>

<style scoped>
.performance-monitor {
  width: 300px;
  font-size: 0.875rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
