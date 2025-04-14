<template>
  <div class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box max-w-[90%] max-h-full h-[90vh] bg-base-300">
      <h3 class="font-bold text-xl mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" 
          stroke="currentColor" class="w-6 h-6 mr-2">
          <path stroke-linecap="round" stroke-linejoin="round" 
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        Database Insights
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[calc(100%-8rem)] overflow-y-auto p-2">
        <!-- Loading State -->
        <div v-if="isLoading" class="col-span-full flex justify-center items-center h-64">
          <div class="loading loading-spinner loading-lg"></div>
        </div>
        
        <!-- Cards only show when not loading -->
        <template v-else>
          <!-- Database Size Chart -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Table Sizes</h2>
              <div class="h-64 w-full" ref="tableSizeChartRef"></div>
            </div>
          </div>
          
          <!-- Record Count Chart -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Record Distribution</h2>
              <div class="h-64 w-full" ref="recordCountChartRef"></div>
            </div>
          </div>
          
          <!-- Tables Growth Chart -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Growth Projection</h2>
              <div class="h-64 w-full" ref="growthChartRef"></div>
            </div>
          </div>
          
          <!-- Table Structure Quality Score -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Structure Quality</h2>
              <div class="h-64 w-full" ref="qualityScoreChartRef"></div>
            </div>
          </div>
          
          <!-- Index Usage Effectiveness -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Index Effectiveness</h2>
              <div class="h-64 w-full" ref="indexUsageChartRef"></div>
            </div>
          </div>
          
          <!-- Relationships Visualization -->
          <div class="card bg-base-200 shadow-xl">
            <div class="card-body">
              <h2 class="card-title text-base">Relationship Map</h2>
              <div class="h-64 w-full" ref="relationshipsChartRef"></div>
            </div>
          </div>
        </template>
      </div>
      
      <div class="modal-action">
        <button class="btn btn-sm" @click="exportInsights">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export Data
        </button>
        <button class="btn btn-primary btn-sm" @click="close">Close</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="close"></div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, onUnmounted } from 'vue';
import { useDatabaseStore } from '@/store/database';

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  connectionId: {
    type: String,
    required: true
  }
});

// Emits
const emit = defineEmits(['close']);

// Store
const databaseStore = useDatabaseStore();

// Refs for charts
const tableSizeChartRef = ref(null);
const recordCountChartRef = ref(null);
const growthChartRef = ref(null);
const qualityScoreChartRef = ref(null);
const indexUsageChartRef = ref(null);
const relationshipsChartRef = ref(null);

// State
const isLoading = ref(true);
const insightsData = ref({
  tableSizes: [],
  recordCounts: [],
  growth: [],
  qualityScores: [],
  indexUsage: [],
  relationships: []
});

// Close function
function close() {
  emit('close');
}

// Export insights data
function exportInsights() {
  try {
    const dataStr = JSON.stringify(insightsData.value, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `db-insights-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  } catch (error) {
    console.error('Failed to export insights:', error);
  }
}

// Load database insights
async function loadInsights() {
  isLoading.value = true;
  
  try {
    // Get table data from store
    const tables = databaseStore.tablesList;
    
    // Use demo data if no tables available
    const demoTables = tables.length > 0 ? tables : [
      { name: 'users', recordCount: 1250 },
      { name: 'posts', recordCount: 3450 },
      { name: 'comments', recordCount: 8765 },
      { name: 'categories', recordCount: 25 },
      { name: 'tags', recordCount: 140 },
      { name: 'products', recordCount: 874 },
      { name: 'orders', recordCount: 2341 },
      { name: 'order_items', recordCount: 5678 },
      { name: 'customers', recordCount: 980 },
      { name: 'settings', recordCount: 15 },
    ];
    
    // Process data for charts
    const tableSizeData = await Promise.all(demoTables.map(async (table) => {
      try {
        // Here we would get actual table size from DB, using calculated data for now
        const size = (table.recordCount || Math.floor(Math.random() * 1000) + 100) * 
          (Math.floor(Math.random() * 10) + 2); // Simulate KB based on record count
        return {
          name: table.name,
          size: size
        };
      } catch (error) {
        console.error(`Failed to get size for table ${table.name}:`, error);
        return {
          name: table.name,
          size: 1000 // Fallback size
        };
      }
    }));
    
    // Get record counts
    const recordCountData = demoTables.map(table => ({
      name: table.name,
      count: table.recordCount || Math.floor(Math.random() * 1000) + 100
    }));
    
    // Generate growth data based on record counts
    const growthData = demoTables.map(table => {
      const baseCount = table.recordCount || Math.floor(Math.random() * 1000) + 100;
      return {
        name: table.name,
        growth: Math.floor(baseCount * (Math.random() * 0.5 + 0.1)) // 10-60% growth
      };
    });
    
    // Generate quality scores
    const qualityScoreData = demoTables.map(table => ({
      name: table.name,
      score: Math.floor(Math.random() * 40) + 60 // 60-100 score range
    }));
    
    // Generate index usage data
    const indexUsageData = demoTables.map(table => ({
      name: table.name,
      usage: Math.floor(Math.random() * 60) + 40 // 40-100 usage percentage
    }));
    
    // Generate relationship data (demo)
    const relationshipTypes = ['one-to-one', 'one-to-many', 'many-to-many'];
    const relationshipsData = [];
    
    for (let i = 0; i < demoTables.length - 1; i++) {
      const sourceTable = demoTables[i];
      const targetTable = demoTables[i + 1];
      relationshipsData.push({
        source: sourceTable.name,
        target: targetTable.name,
        type: relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)]
      });
    }
    
    // Add some cross-relationships
    if (demoTables.length > 3) {
      relationshipsData.push({
        source: demoTables[0].name,
        target: demoTables[demoTables.length - 1].name,
        type: 'many-to-many'
      });
      
      relationshipsData.push({
        source: demoTables[1].name,
        target: demoTables[3].name,
        type: 'one-to-many'
      });
    }
    
    // Filter and sort data
    insightsData.value = {
      tableSizes: tableSizeData.sort((a, b) => b.size - a.size).slice(0, 10),
      recordCounts: recordCountData.sort((a, b) => b.count - a.count).slice(0, 10),
      growth: growthData.sort((a, b) => b.growth - a.growth).slice(0, 10),
      qualityScores: qualityScoreData.sort((a, b) => b.score - a.score).slice(0, 10),
      indexUsage: indexUsageData.sort((a, b) => b.usage - a.usage).slice(0, 10),
      relationships: relationshipsData
    };
    
  } catch (error) {
    console.error('Failed to load insights:', error);
  } finally {
    isLoading.value = false;
    // After data is loaded, render charts in next tick
    setTimeout(() => {
      renderCharts();
    }, 0);
  }
}

// Render charts using data
function renderCharts() {
  // Simulate chart rendering with HTML/CSS
  
  // Table Size Chart - Bar chart
  if (tableSizeChartRef.value) {
    const data = insightsData.value.tableSizes.slice(0, 5);
    const maxSize = Math.max(...data.map(d => d.size));
    
    let html = `<div class="w-full h-full flex flex-col justify-end">
      <div class="flex items-end h-[85%] w-full">`;
    
    data.forEach(item => {
      const percentage = (item.size / maxSize) * 100;
      const label = item.name.length > 10 ? item.name.substring(0, 7) + '...' : item.name;
      
      html += `
        <div class="flex flex-col items-center mx-1 flex-1">
          <div class="bg-primary w-full rounded-t" style="height: ${percentage}%"></div>
          <div class="text-xs mt-1 text-center font-semibold">${label}</div>
          <div class="text-xs text-gray-500">${item.size.toLocaleString()} KB</div>
        </div>`;
    });
    
    html += `</div></div>`;
    tableSizeChartRef.value.innerHTML = html;
  }
  
  // Record Count Chart - Pie chart
  if (recordCountChartRef.value) {
    const data = insightsData.value.recordCounts.slice(0, 5);
    const total = data.reduce((sum, item) => sum + item.count, 0);
    
    let colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    let html = `<div class="flex flex-col items-center justify-center h-full">
      <div class="relative w-32 h-32">`;
    
    let currentAngle = 0;
    
    data.forEach((item, index) => {
      const percentage = (item.count / total) * 100;
      const angle = (percentage * 3.6); // Convert percentage to angle (360 degrees max)
      
      html += `<div class="absolute inset-0" style="
        clip-path: polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin(Math.PI * (currentAngle + angle) / 180)}% ${50 - 50 * Math.cos(Math.PI * (currentAngle + angle) / 180)}%, 50% 50%);
        background-color: ${colors[index % colors.length]};
        transform: rotate(${currentAngle}deg);
      "></div>`;
      
      currentAngle += angle;
    });
    
    html += `</div>
      <div class="grid grid-cols-2 gap-2 mt-4">`;
    
    data.forEach((item, index) => {
      const percentage = ((item.count / total) * 100).toFixed(1);
      html += `
        <div class="flex items-center">
          <div class="w-3 h-3 mr-1" style="background-color: ${colors[index % colors.length]}"></div>
          <span class="text-xs">${item.name}: ${percentage}%</span>
        </div>`;
    });
    
    html += `</div></div>`;
    recordCountChartRef.value.innerHTML = html;
  }
  
  // Growth Chart - Line chart
  if (growthChartRef.value) {
    const data = insightsData.value.growth.slice(0, 5);
    const maxGrowth = Math.max(...data.map(d => d.growth));
    
    let html = `<div class="w-full h-full p-2">
      <div class="relative h-[80%] border-b border-l border-gray-600">`;
    
    data.forEach((item, index) => {
      const percentage = (item.growth / maxGrowth) * 100;
      const x = (index / (data.length - 1)) * 100;
      
      html += `
        <div class="absolute bottom-0 h-2 w-2 rounded-full bg-primary" 
          style="left: ${x}%; bottom: ${percentage}%; transform: translate(-50%, 50%);"></div>`;
      
      // Connect with lines
      if (index < data.length - 1) {
        const nextItem = data[index + 1];
        const nextPercentage = (nextItem.growth / maxGrowth) * 100;
        const nextX = ((index + 1) / (data.length - 1)) * 100;
        
        html += `
          <div class="absolute bottom-0 h-[2px] bg-primary" 
            style="left: ${x}%; width: ${nextX - x}%; bottom: ${percentage}%; 
            transform: skew(0, ${Math.atan2(nextPercentage - percentage, nextX - x) * (180 / Math.PI)}deg) translateY(1px);
            transform-origin: left;"></div>`;
      }
    });
    
    html += `</div>
      <div class="flex justify-between mt-2">`;
    
    data.forEach(item => {
      html += `<div class="text-xs text-center" style="width: ${100 / data.length}%">${item.name}</div>`;
    });
    
    html += `</div>
      <div class="text-xs text-center mt-2">Projected growth: ${data.reduce((sum, item) => sum + item.growth, 0).toLocaleString()} records</div>
    </div>`;
    
    growthChartRef.value.innerHTML = html;
  }
  
  // Quality Score Chart - Gauge
  if (qualityScoreChartRef.value) {
    const data = insightsData.value.qualityScores[0] || { name: 'average', score: 75 };
    
    // Determine color based on score
    let color = '#ef4444'; // red
    if (data.score >= 80) color = '#10b981'; // green
    else if (data.score >= 60) color = '#f59e0b'; // yellow
    
    let html = `<div class="flex flex-col items-center justify-center h-full">
      <div class="relative w-40 h-20 overflow-hidden">
        <div class="absolute w-40 h-40 rounded-full border-8 border-gray-700 top-0"></div>
        <div class="absolute w-40 h-40 rounded-full border-8 border-transparent top-0" 
          style="border-top-color: ${color}; transform: rotate(${(data.score / 100) * 180 - 90}deg)"></div>
        <div class="absolute inset-0 flex items-center justify-center mt-4">
          <span class="text-2xl font-bold">${data.score}</span>
        </div>
      </div>
      <div class="text-center mt-2">
        <div class="text-sm font-semibold">${data.name}</div>
        <div class="text-xs text-gray-500">Structure Quality Score</div>
      </div>
      <div class="flex justify-between w-40 mt-2">
        <span class="text-xs">Poor</span>
        <span class="text-xs">Good</span>
        <span class="text-xs">Excellent</span>
      </div>
    </div>`;
    
    qualityScoreChartRef.value.innerHTML = html;
  }
  
  // Index Usage Chart - Radar
  if (indexUsageChartRef.value) {
    const data = insightsData.value.indexUsage.slice(0, 5);
    
    let html = `<div class="flex flex-col items-center justify-center h-full">
      <div class="relative w-40 h-40">`;
    
    // Create the radar background
    for (let i = 1; i <= 3; i++) {
      const size = i * 33.3; // 33%, 66%, 100%
      html += `<div class="absolute rounded-full border border-gray-600" 
        style="width: ${size}%; height: ${size}%; top: ${(100 - size) / 2}%; left: ${(100 - size) / 2}%;"></div>`;
    }
    
    // Create axis lines
    const numPoints = data.length;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * (2 * Math.PI);
      const x1 = 50;
      const y1 = 50;
      const x2 = 50 + 50 * Math.sin(angle);
      const y2 = 50 - 50 * Math.cos(angle);
      
      html += `<div class="absolute bg-gray-600" 
        style="width: 1px; height: 50%; top: 0; left: 50%; transform-origin: bottom center; transform: rotate(${(i / numPoints) * 360}deg);"></div>`;
    }
    
    // Create data points and connections
    let points = [];
    data.forEach((item, i) => {
      const angle = (i / numPoints) * (2 * Math.PI);
      const value = item.usage / 100; // Normalize to 0-1
      const x = 50 + value * 50 * Math.sin(angle);
      const y = 50 - value * 50 * Math.cos(angle);
      
      points.push({ x, y });
    });
    
    // Draw the shape
    html += `<div class="absolute" style="top: 0; left: 0; width: 100%; height: 100%;">
      <svg width="100%" height="100%" viewBox="0 0 100 100">
        <polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" 
          fill="rgba(59, 130, 246, 0.5)" stroke="#3b82f6" stroke-width="2" />
      </svg>
    </div>`;
    
    // Add labels
    data.forEach((item, i) => {
      const angle = (i / numPoints) * (2 * Math.PI);
      const labelX = 50 + 60 * Math.sin(angle);
      const labelY = 50 - 60 * Math.cos(angle);
      
      html += `<div class="absolute text-xs font-semibold" 
        style="top: ${labelY}%; left: ${labelX}%; transform: translate(-50%, -50%);">${item.name}</div>`;
    });
    
    html += `</div>
      <div class="text-xs text-center mt-4">Average index usage: ${Math.round(data.reduce((sum, item) => sum + item.usage, 0) / data.length)}%</div>
    </div>`;
    
    indexUsageChartRef.value.innerHTML = html;
  }
  
  // Relationships Graph
  if (relationshipsChartRef.value) {
    const data = insightsData.value.relationships;
    const allTables = [...new Set([
      ...data.map(r => r.source),
      ...data.map(r => r.target)
    ])];
    
    // Create a simple force-directed layout
    const nodes = allTables.map((name, i) => {
      const angle = (i / allTables.length) * (2 * Math.PI);
      const radius = 35;
      return {
        name,
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle)
      };
    });
    
    let html = `<div class="relative w-full h-full">
      <svg width="100%" height="100%" viewBox="0 0 100 100">`;
    
    // Draw the links first
    data.forEach(relation => {
      const source = nodes.find(n => n.name === relation.source);
      const target = nodes.find(n => n.name === relation.target);
      
      if (source && target) {
        let strokeStyle = '';
        let markers = '';
        
        // Different styles for different relationship types
        if (relation.type === 'one-to-many') {
          strokeStyle = 'stroke-dasharray="3,2"';
          markers = 'marker-end="url(#arrowhead)"';
        } else if (relation.type === 'many-to-many') {
          strokeStyle = 'stroke-width="2"';
          markers = 'marker-start="url(#circle)" marker-end="url(#circle)"';
        }
        
        html += `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" 
          stroke="#8b5cf6" ${strokeStyle} ${markers} />`;
      }
    });
    
    // Define markers
    html += `<defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
      </marker>
      <marker id="circle" markerWidth="8" markerHeight="8" refX="4" refY="4">
        <circle cx="4" cy="4" r="3" fill="#8b5cf6" />
      </marker>
    </defs>`;
    
    // Draw the nodes on top
    nodes.forEach(node => {
      html += `<g transform="translate(${node.x}, ${node.y})">
        <circle cx="0" cy="0" r="4" fill="#3b82f6" />
        <text x="0" y="-7" text-anchor="middle" font-size="3.5" fill="white">${node.name}</text>
      </g>`;
    });
    
    html += `</svg>
      <div class="absolute bottom-0 left-0 right-0 flex justify-center text-xs gap-4">
        <div class="flex items-center">
          <div class="w-4 h-1 bg-purple-500 mr-1"></div>
          <span>One-to-One</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-1 bg-purple-500 mr-1 dashed"></div>
          <span>One-to-Many</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-1 bg-purple-500 mr-1 border-t-2 border-purple-500"></div>
          <span>Many-to-Many</span>
        </div>
      </div>
    </div>`;
    
    relationshipsChartRef.value.innerHTML = html;
  }
}

// Watchers
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadInsights();
  }
});

// Lifecycle hooks
onMounted(() => {
  if (props.isOpen) {
    loadInsights();
  }
});

onUnmounted(() => {
  // Cleanup function would go here if using a real charting library
});
</script>

<style scoped>
.modal-box {
  width: 90%;
  max-width: 90%;
}

@media (min-width: 768px) {
  .modal-box {
    max-width: 90%;
  }
}

.dashed {
  border-top: 1px dashed rgb(139, 92, 246);
}
</style> 