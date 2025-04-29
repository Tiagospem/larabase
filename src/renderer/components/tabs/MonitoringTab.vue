<template>
  <div class="h-full flex flex-col bg-base-200 overflow-hidden">
    <div class="p-4 flex flex-col h-full overflow-auto">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Laravel Job Batches Monitoring</h2>

        <div class="flex items-center gap-2">
          <fieldset class="fieldset">
            <label class="label cursor-pointer flex items-center gap-2">
              <span class="label-text">Auto Refresh</span>
              <input
                type="checkbox"
                v-model="autoRefresh"
                class="toggle toggle-primary toggle-sm"
              />
            </label>
          </fieldset>

          <select
            v-model="timeRange"
            class="select select-sm select-bordered"
          >
            <option value="1">Last hour</option>
            <option value="3">Last 3 hours</option>
            <option value="6">Last 6 hours</option>
            <option value="12">Last 12 hours</option>
            <option value="24">Last 24 hours</option>
          </select>
        </div>
      </div>
      <div
        v-if="apiError"
        class="alert alert-error mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ apiErrorMessage }}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div class="stat bg-base-100 shadow">
          <div class="stat-title">Total Batches</div>
          <div class="stat-value">{{ stats.totalBatches }}</div>
          <div class="stat-desc">In selected time range</div>
        </div>

        <div class="stat bg-base-100 shadow">
          <div class="stat-title">Running Batches</div>
          <div class="stat-value text-primary">{{ stats.runningBatches }}</div>
          <div class="stat-desc">Currently in progress</div>
        </div>

        <div class="stat bg-base-100 shadow">
          <div class="stat-title">Completed</div>
          <div class="stat-value text-success">{{ stats.completedBatches }}</div>
          <div class="stat-desc">Successfully finished</div>
        </div>

        <div class="stat bg-base-100 shadow">
          <div class="stat-title">Failed</div>
          <div class="stat-value text-error">{{ stats.failedBatches }}</div>
          <div class="stat-desc">With one or more failures</div>
        </div>
      </div>

      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-base-100 p-4 shadow rounded-lg overflow-hidden">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold">Active Batches</h3>
            <div class="text-xs">Showing {{ visibleActiveBatches.length }} of {{ allActiveBatches.length }}</div>
          </div>

          <div
            v-if="allActiveBatches.length === 0"
            class="text-center p-4 text-opacity-60"
          >
            No active batches found
          </div>
          <div
            v-else
            class="space-y-3 overflow-auto max-h-[400px]"
          >
            <div
              v-for="batch in visibleActiveBatches"
              :key="batch.id"
              class="card bg-base-200"
            >
              <div class="card-body p-3">
                <div class="flex justify-between items-start">
                  <div class="font-mono text-sm">{{ batch.id }}</div>
                  <div class="badge badge-sm badge-primary">Active</div>
                </div>
                <div class="text-sm">
                  <div><span class="font-semibold">Name:</span> {{ batch.name }}</div>
                  <div class="mt-1"><span class="font-semibold">Started:</span> {{ formatDate(batch.created_at) }}</div>
                  <div class="mt-1 flex items-center">
                    <span class="font-semibold mr-2">Progress:</span>
                    <div class="w-56 relative overflow-hidden bg-base-200 rounded-full h-2">
                      <div class="bg-primary h-2 rounded-full transition-all indeterminate-progress"></div>
                    </div>
                    <span class="ml-2">{{ Number(batch.processed_jobs || 0) }}/{{ Number(batch.total_jobs || 1) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="allActiveBatches.length > visibleActiveBatches.length"
              class="btn btn-sm btn-outline w-full"
              @click="showMoreActiveBatches"
            >
              Show More ({{ allActiveBatches.length - visibleActiveBatches.length }} remaining)
            </button>
          </div>
        </div>

        <div class="bg-base-100 p-4 shadow rounded-lg overflow-hidden">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold">Recent Batches</h3>
            <div class="text-xs">Showing {{ visibleRecentBatches.length }} of {{ allRecentBatches.length }}</div>
          </div>

          <div
            v-if="allRecentBatches.length === 0"
            class="text-center p-4 text-opacity-60"
          >
            No recent batches found
          </div>
          <div
            v-else
            class="space-y-3 overflow-auto max-h-[400px]"
          >
            <div
              v-for="batch in visibleRecentBatches"
              :key="batch.id"
              class="card"
              :class="{ 'bg-base-200': !batch.failed_jobs, 'bg-error bg-opacity-10': batch.failed_jobs > 0 }"
            >
              <div class="card-body p-3">
                <div class="flex justify-between items-start">
                  <div class="font-mono text-sm">{{ batch.id }}</div>
                  <div :class="batch.failed_jobs > 0 ? 'badge badge-sm badge-error' : 'badge badge-sm badge-success'">
                    {{ batch.failed_jobs > 0 ? "Failed" : "Completed" }}
                  </div>
                </div>
                <div class="text-sm">
                  <div><span class="font-semibold">Name:</span> {{ batch.name }}</div>
                  <div class="mt-1"><span class="font-semibold">Started:</span> {{ formatDate(batch.created_at) }}</div>
                  <div class="mt-1"><span class="font-semibold">Finished:</span> {{ formatDate(batch.finished_at) }}</div>
                  <div class="mt-1"><span class="font-semibold">Duration:</span> {{ calculateDuration(batch.created_at, batch.finished_at) }}</div>
                  <div class="mt-1">
                    <span class="font-semibold">Jobs:</span>
                    {{ Number(batch.total_jobs || 0) - Number(batch.failed_jobs || 0) }} success / {{ Number(batch.failed_jobs || 0) }} failed / {{ Number(batch.total_jobs || 0) }} total
                  </div>
                  <div
                    v-if="batch.failed_jobs > 0"
                    class="mt-2"
                  >
                    <div class="font-semibold text-error">Failure Information:</div>
                    <div class="mt-1 whitespace-pre-wrap font-mono text-xs bg-base-300 p-2 rounded max-h-24 overflow-auto">
                      {{ formatExceptions(batch.failures) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="allRecentBatches.length > visibleRecentBatches.length"
              class="btn btn-sm btn-outline w-full"
              @click="showMoreRecentBatches"
            >
              Show More ({{ allRecentBatches.length - visibleRecentBatches.length }} remaining)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";

dayjs.extend(relativeTime);
dayjs.extend(duration);

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  tableName: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["load"]);

const loading = ref(false);
const allActiveBatches = ref([]);
const allRecentBatches = ref([]);
const activePageSize = ref(5);
const recentPageSize = ref(5);
const apiError = ref(false);
const apiErrorMessage = ref("");
const stats = ref({
  totalBatches: 0,
  runningBatches: 0,
  completedBatches: 0,
  failedBatches: 0
});
const timeRange = ref("6");
const autoRefresh = ref(true);
const refreshInterval = ref(null);
const isInitialLoad = ref(true);
const lastLoadTime = ref(0);

const visibleActiveBatches = computed(() => {
  return allActiveBatches.value.slice(0, activePageSize.value);
});

const visibleRecentBatches = computed(() => {
  return allRecentBatches.value.slice(0, recentPageSize.value);
});

function showMoreActiveBatches() {
  activePageSize.value += 5;
}

function showMoreRecentBatches() {
  recentPageSize.value += 5;
}

async function loadData() {
  const now = Date.now();

  if (now - lastLoadTime.value < 1000) {
    return;
  }

  lastLoadTime.value = now;

  if (loading.value) return;
  if (props.tableName !== "job_batches") return;

  apiError.value = false;
  apiErrorMessage.value = "";

  loading.value = true;
  const loadingTimeoutId = setTimeout(() => {
    loading.value = false;
  }, 10000);

  try {
    if (!window.api || !window.api.executeSQLQuery) {
      console.error("API method executeSQLQuery is not available");
      apiError.value = true;
      apiErrorMessage.value = "The SQL query API is not available. This feature requires SQL query execution privileges.";
      loading.value = false;
      return;
    }

    const fromTime = dayjs().subtract(parseInt(timeRange.value), "hour").format("YYYY-MM-DD HH:mm:ss");

    const query = `
      SELECT * FROM ${props.tableName}
      WHERE created_at >= '${fromTime}'
      ORDER BY created_at DESC
    `;

    const result = await window.api.executeSQLQuery({
      connectionId: props.connectionId,
      query: query
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch batch data");
    }

    const allBatches = result.results || [];

    // Reset page sizes on data refresh
    activePageSize.value = 5;
    recentPageSize.value = 5;

    allActiveBatches.value = allBatches.filter((b) => !b.finished_at);
    allRecentBatches.value = allBatches.filter((b) => b.finished_at).sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at));

    stats.value = {
      totalBatches: allBatches.length,
      runningBatches: allActiveBatches.value.length,
      completedBatches: allBatches.filter((b) => b.finished_at && b.failed_jobs === 0).length,
      failedBatches: allBatches.filter((b) => b.failed_jobs > 0).length
    };

    emit("load", { success: true });
  } catch (error) {
    console.error("Error loading batch data:", error);
    emit("load", { success: false, error: error.message });

    allActiveBatches.value = [];
    allRecentBatches.value = [];
    stats.value = {
      totalBatches: 0,
      runningBatches: 0,
      completedBatches: 0,
      failedBatches: 0
    };
  } finally {
    loading.value = false;
    clearTimeout(loadingTimeoutId);
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return dayjs(dateString).format("YYYY-MM-DD HH:mm:ss");
}

function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return "N/A";

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const diff = end.diff(start);

  if (diff < 1000) {
    return `${diff}ms`;
  } else if (diff < 60000) {
    return `${Math.floor(diff / 1000)}s`;
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  } else {
    const duration = dayjs.duration(diff);
    return `${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;
  }
}

function formatExceptions(failures) {
  if (!failures) return "No failure information available";

  try {
    const parsedFailures = typeof failures === "string" ? JSON.parse(failures) : failures;

    if (Array.isArray(parsedFailures)) {
      return parsedFailures
        .map((f) => {
          if (typeof f === "string") return f;
          return f.message || JSON.stringify(f);
        })
        .join("\n");
    }

    return JSON.stringify(parsedFailures, null, 2);
  } catch (e) {
    return failures.toString();
  }
}

function setupAutoRefresh() {
  clearInterval(refreshInterval.value);

  if (autoRefresh.value) {
    refreshInterval.value = setInterval(() => {
      loadData();
    }, 5000);
  }
}

watch(autoRefresh, () => {
  setupAutoRefresh();
});

watch(timeRange, () => {
  if (!isInitialLoad.value) {
    loadData();
  }
});

onMounted(() => {
  loadData();
  setupAutoRefresh();
  isInitialLoad.value = false;
});

onBeforeUnmount(() => {
  clearInterval(refreshInterval.value);
  loading.value = false;
});
</script>

<style>
.indeterminate-progress {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
  transform-origin: 0% 50%;
}

@keyframes progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(300%);
  }
}
</style>
