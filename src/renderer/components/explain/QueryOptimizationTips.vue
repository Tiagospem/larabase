<template>
  <div class="query-optimization-tips">
    <div
      v-if="loading"
      class="flex justify-center py-4"
    >
      <div class="loading loading-spinner"></div>
    </div>

    <div
      v-else-if="tips.length === 0"
      class="text-center py-4 text-gray-500"
    >
      No optimization tips available for this query.
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="(tip, index) in tips"
        :key="index"
        class="card bg-base-200 shadow-sm hover:shadow-md transition-all"
      >
        <div class="card-body p-4">
          <h4 class="card-title text-base flex items-center gap-2">
            <span
              class="badge"
              :class="getImpactBadgeClass(tip.impact)"
            >
              {{ tip.impact.toUpperCase() }}
            </span>
            {{ tip.title }}
          </h4>

          <p class="my-2">{{ tip.description }}</p>

          <div
            v-if="tip.code"
            class="bg-base-300 p-3 rounded font-mono text-sm mb-2"
          >
            {{ tip.code }}
          </div>

          <div
            v-if="tip.alternatives && tip.alternatives.length > 0"
            class="mt-2"
          >
            <div class="font-medium text-sm mb-1">Alternatives:</div>
            <ul class="list-disc list-inside space-y-1">
              <li
                v-for="(alt, altIndex) in tip.alternatives"
                :key="altIndex"
                class="text-sm"
              >
                {{ alt }}
              </li>
            </ul>
          </div>

          <div
            v-if="tip.implementation"
            class="mt-3 flex justify-end"
          >
            <button
              class="btn btn-sm btn-primary"
              @click="implementTip(tip)"
            >
              Apply Suggestion
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  explainData: {
    type: Array,
    required: true
  },
  query: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["implement-tip"]);

const loading = ref(false);
const tips = ref([]);

// Watch for changes in explain data to regenerate tips
watch(
  [() => props.explainData, () => props.query],
  () => {
    generateOptimizationTips();
  },
  { immediate: true }
);

function generateOptimizationTips() {
  loading.value = true;
  tips.value = [];

  if (!props.explainData || props.explainData.length === 0 || !props.query) {
    loading.value = false;
    return;
  }

  // Short timeout to make it feel like analysis is happening
  setTimeout(() => {
    analyzeExplainData();
    analyzeQueryStructure();
    loading.value = false;
  }, 500);
}

function analyzeExplainData() {
  const data = props.explainData;

  // Check for full table scans
  for (const row of data) {
    if (row.type === "ALL") {
      tips.value.push({
        impact: "high",
        title: "Avoid full table scan",
        description: `The query is performing a full table scan on table '${row.table}'. This can be inefficient for large tables.`,
        code: `CREATE INDEX idx_${row.table}_columns ON ${row.table} (column_used_in_where_clause);`,
        alternatives: ["Add an index that covers columns used in the WHERE clause", "Limit the number of rows returned if possible", "Consider using a more selective condition"]
      });
    }

    // Check for temporary tables
    if (row.Extra?.includes("Using temporary")) {
      tips.value.push({
        impact: "medium",
        title: "Avoid temporary tables",
        description: "The query creates a temporary table, which can impact performance.",
        alternatives: [
          "Add indexes on columns used in GROUP BY and ORDER BY clauses",
          "Simplify the query to avoid operations requiring temporary tables",
          "Consider splitting complex queries into simpler ones"
        ]
      });
    }

    // Check for filesort
    if (row.Extra?.includes("Using filesort")) {
      tips.value.push({
        impact: "medium",
        title: "Eliminate filesort",
        description: "The query uses filesort operation which can be slow for large datasets.",
        code: `CREATE INDEX idx_${row.table}_sort ON ${row.table} (columns_in_order_by);`,
        alternatives: ["Create an index that includes both WHERE and ORDER BY columns", "Consider if the sort is necessary or can be done at application level"]
      });
    }

    // Check for inefficient joins
    if (row.type === "ALL" && row.Extra?.includes("Using join buffer")) {
      tips.value.push({
        impact: "high",
        title: "Optimize join operation",
        description: `The join with table '${row.table}' is not using an index.`,
        code: `CREATE INDEX idx_${row.table}_join ON ${row.table} (join_column);`,
        alternatives: ["Add an index on the join columns", "Restructure the query to use more efficient join types"]
      });
    }

    // Missing index in WHERE condition
    if (row.possible_keys === null && !row.key && row.ref === null) {
      tips.value.push({
        impact: "high",
        title: "Add index for WHERE conditions",
        description: `Table '${row.table}' has no usable index for this query.`,
        code: `-- Create an appropriate index based on your WHERE conditions\nCREATE INDEX idx_${row.table}_filter ON ${row.table} (column_in_where);`
      });
    }
  }
}

function analyzeQueryStructure() {
  const query = props.query.toLowerCase();

  // Check for SELECT *
  if (query.includes("select *")) {
    tips.value.push({
      impact: "low",
      title: "Avoid SELECT *",
      description: "Selecting all columns can be inefficient. Select only the columns you need.",
      code: query.replace(/select \*/i, "SELECT column1, column2, column3"),
      implementation: {
        type: "replace",
        pattern: /select \*/i,
        replacement: "SELECT specific_columns"
      }
    });
  }

  // Check for ORDER BY without LIMIT
  if (query.includes("order by") && !query.includes("limit")) {
    tips.value.push({
      impact: "medium",
      title: "Add LIMIT clause",
      description: "Using ORDER BY without LIMIT can cause the database to sort the entire result set unnecessarily.",
      code: query + " LIMIT 100",
      implementation: {
        type: "append",
        value: " LIMIT 100"
      }
    });
  }

  // Check for complex JOINs
  const joinCount = (query.match(/join/gi) || []).length;
  if (joinCount > 2) {
    tips.value.push({
      impact: "medium",
      title: "Simplify complex joins",
      description: `The query contains ${joinCount} joins, which might impact performance.`,
      alternatives: ["Consider breaking down into multiple simpler queries", "Ensure all join columns are properly indexed", "Evaluate if all joins are necessary"]
    });
  }

  // Check for LIKE with leading wildcard
  if (query.includes("like") && query.includes("%")) {
    const hasLeadingWildcard = query.match(/like\s+['"]%/i);
    if (hasLeadingWildcard) {
      tips.value.push({
        impact: "high",
        title: "Avoid leading wildcard in LIKE",
        description: 'Using a leading wildcard (LIKE "%text") prevents the database from using indexes effectively.',
        alternatives: ["Restructure query to avoid leading wildcards", "Consider using full-text search for better performance", 'If possible, use LIKE "text%" instead of LIKE "%text"']
      });
    }
  }
}

function getImpactBadgeClass(impact) {
  switch (impact.toLowerCase()) {
    case "high":
      return "badge-error";
    case "medium":
      return "badge-warning";
    case "low":
      return "badge-success";
    default:
      return "badge-info";
  }
}

function implementTip(tip) {
  emit("implement-tip", tip);
}
</script>

<style scoped>
.query-optimization-tips {
  margin-top: 1rem;
}
</style>
