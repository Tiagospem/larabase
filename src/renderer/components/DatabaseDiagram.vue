<template>
  <div class="modal" :class="{ 'modal-open': isOpen }" @transitionend="onModalFullyOpen">
    <div class="modal-box max-w-4xl bg-base-300">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">
          {{ hasRelationships ? 'Database Schema Diagram' : 'Database Relationship Explorer' }}
        </h3>
        <div class="flex gap-2">
          <div class="badge" :class="hasRelationships ? 'badge-success' : 'badge-warning'">
            {{ hasRelationships ? `${relationships.length} Relations Found` : 'No Relations' }}
          </div>
          
          <button class="btn btn-sm btn-ghost" @click="onRefreshClick">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5" 
              stroke="currentColor"
              class="w-4 h-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round" 
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        <span class="ml-3 text-sm">Analyzing database schema...</span>
      </div>

      <!-- No relationships found -->
      <div v-else-if="!loading && !hasRelationships" class="alert alert-warning mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current shrink-0 w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>No relationships found between tables. The database schema might not have defined foreign key constraints.</span>
      </div>

      <!-- Diagram visualization area -->
      <div v-else ref="diagramContainer" class="diagram-container bg-base-200 rounded-lg p-4">
        <div class="diagram-controls mb-2 flex justify-between">
          <div>
            <button class="btn btn-xs" @click="zoomIn">
              Zoom In
            </button>
            <button class="btn btn-xs ml-1" @click="zoomOut">
              Zoom Out
            </button>
            <button class="btn btn-xs ml-1" @click="resetZoom">
              Reset
            </button>
          </div>
          <select v-model="focusTable" class="select select-xs select-bordered">
            <option value="">
              Show All Tables
            </option>
            <option v-for="table in tablesList" :key="table" :value="table">
              {{ table }}
            </option>
          </select>
        </div>
        
        <div ref="svgContainer" class="diagram-svg-container">
          <!-- SVG diagram will be rendered here -->
        </div>
        
        <!-- Info panel with instructions -->
        <div class="info-panel">
          <p class="mb-2">
            <span class="font-bold">Tips:</span>
            <ul class="mt-1 text-xs">
              <li>• Drag tables to reposition</li>
              <li>• Click a table to focus on it</li>
              <li>• Use mouse wheel to zoom in/out</li>
              <li>• Drag background to pan when zoomed</li>
              <li>• Dotted lines indicate inferred relationships</li>
              <li>• Use dropdown to filter by table</li>
            </ul>
          </p>
          <div class="text-xs mt-3">
            Relationship count: {{ relationships.length }}
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-primary" @click="close">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useDatabaseStore } from '@/store/database';

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

const emit = defineEmits(['close']);
const databaseStore = useDatabaseStore();

const loading = ref(false);
const relationships = ref([]);
const tablesList = ref([]);
const focusTable = ref('');
const diagramContainer = ref(null);
const svgContainer = ref(null);
const zoomLevel = ref(1);

// D3.js will be loaded dynamically when the component is mounted
let d3;

const hasRelationships = computed(() => relationships.value.length > 0);

// Add panning variables to track the diagram position
const panPosition = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const lastMousePosition = ref({ x: 0, y: 0 });

function close () {
  emit('close');
}

async function loadD3 () {
  if (!window.d3) {
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://d3js.org/d3.v7.min.js';
      script.onload = () => resolve(window.d3);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return window.d3;
}

async function refreshDiagram () {
  if (!props.connectionId) return;
  
  try {
    
    if (databaseStore.tablesList.length === 0) {
      await databaseStore.loadTables(props.connectionId);
    }
    
    
    tablesList.value = databaseStore.tablesList.map(t => t.name);
    
    
    const relationshipsData = await window.api.getDatabaseRelationships(props.connectionId);
    
    
    if (relationshipsData && relationshipsData.success === false) {
      console.error('Error fetching relationships:', relationshipsData.message);
      relationships.value = [];
    } else {
      
      if (Array.isArray(relationshipsData)) {
        relationships.value = relationshipsData;
        console.log(`Loaded ${relationshipsData.length} relationships for diagram`);
      } else {
        console.error('Invalid relationships data format:', relationshipsData);
        relationships.value = [];
      }
    }
    
    
    if (!d3) {
      d3 = await loadD3();
    }
    
  } catch (error) {
    console.error('Error fetching database relationships:', error);
    relationships.value = [];
  }
}

function renderDiagram () {
  if (!d3 || !svgContainer.value) return;
  
  
  svgContainer.value.innerHTML = '';
  
  const width = svgContainer.value.clientWidth;
  const height = 500;
  
  // Filter relationships based on the selected focus table
  const filteredRelationships = focusTable.value 
    ? relationships.value.filter(rel => 
        rel.sourceTable === focusTable.value || rel.targetTable === focusTable.value)
    : relationships.value;
  
  // Extract unique tables from relationships
  const tables = [...new Set([
    ...filteredRelationships.map(r => r.sourceTable),
    ...filteredRelationships.map(r => r.targetTable)
  ])];
  
  // Create SVG
  const svg = d3.select(svgContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height]);
    
  
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', 'transparent')
    .style('cursor', 'move')
    .on('mousedown', startPan)
    .on('mousemove', pan)
    .on('mouseup', endPan)
    .on('mouseleave', endPan);
  
  
  const mainGroup = svg.append('g')
    .attr('transform', `translate(${panPosition.value.x}, ${panPosition.value.y}) scale(${zoomLevel.value})`);
  
  
  const simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(180))
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(80)); 
  
  
  const tableInfo = {};
  
  
  if (databaseStore.tablesList.length > 0) {
    databaseStore.tablesList.forEach(tableData => {
      if (tables.includes(tableData.name)) {
        tableInfo[tableData.name] = {
          columnCount: tableData.columnCount || 0
        };
      }
    });
  }
  
  
  const nodes = tables.map(table => ({ 
    id: table, 
    table,
    columnCount: tableInfo[table]?.columnCount || '?',
    isFocused: table === focusTable.value,
    relCount: filteredRelationships.filter(r => 
      r.sourceTable === table || r.targetTable === table
    ).length
  }));
  
  
  const links = filteredRelationships.map(rel => ({
    source: rel.sourceTable,
    target: rel.targetTable,
    relation: `${rel.sourceColumn} → ${rel.targetColumn}`,
    isInferred: rel.inferred || false
  }));
  
  
  const relationshipCounts = {};
  tables.forEach(table => {
    relationshipCounts[table] = {
      incoming: filteredRelationships.filter(r => r.targetTable === table).length,
      outgoing: filteredRelationships.filter(r => r.sourceTable === table).length
    };
  });
  
  
  mainGroup.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 28)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#666');
  
  
  mainGroup.append('defs').append('marker')
    .attr('id', 'arrowhead-inferred')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 28)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#999')
    .attr('stroke-dasharray', '2,2');
  
  
  const link = mainGroup.append('g')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.isInferred ? '#999' : '#666')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', d => d.isInferred ? '3,3' : null)
    .attr('marker-end', d => d.isInferred ? 'url(#arrowhead-inferred)' : 'url(#arrowhead)');
  
  
  const linkText = mainGroup.append('g')
    .selectAll('text')
    .data(links)
    .enter()
    .append('text')
    .attr('font-size', '8px')
    .attr('fill', d => d.isInferred ? '#999' : '#aaa')
    .attr('text-anchor', 'middle')
    .text(d => d.relation);
  
  
  const node = mainGroup.append('g')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', d => d.isFocused ? 'node-focused' : 'node');
  
  
  node.append('rect')
    .attr('width', 140)
    .attr('height', 60)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('fill', d => d.isFocused ? '#2a4365' : '#333')
    .attr('stroke', d => d.isFocused ? '#4b9afa' : '#666')
    .attr('stroke-width', d => d.isFocused ? 2 : 1);
  
  
  node.append('text')
    .attr('dx', 70)
    .attr('dy', 20)
    .attr('text-anchor', 'middle')
    .attr('fill', 'white')
    .attr('font-size', '12px')
    .attr('font-weight', 'bold')
    .text(d => d.table);
  
  
  node.append('text')
    .attr('dx', 70)
    .attr('dy', 38)
    .attr('text-anchor', 'middle')
    .attr('fill', '#bbb')
    .attr('font-size', '10px')
    .text(d => `Columns: ${d.columnCount}`);
  
  
  node.append('text')
    .attr('dx', 70)
    .attr('dy', 52)
    .attr('text-anchor', 'middle')
    .attr('fill', '#bbb')
    .attr('font-size', '9px')
    .text(d => {
      const counts = relationshipCounts[d.id];
      return `Rel: ${counts.incoming} in, ${counts.outgoing} out`;
    });
  
  
  node.call(d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended))
    .on('click', (event, d) => {
      
      focusTable.value = d.id === focusTable.value ? '' : d.id;
    });
  
  // Position nodes and links initially before simulation
  // This prevents the diagram from being invisible until interaction
  link
    .attr('x1', d => {
      const sourceNode = nodes.find(n => n.id === d.source);
      return sourceNode ? (width / 2) : 0;
    })
    .attr('y1', d => {
      const sourceNode = nodes.find(n => n.id === d.source);
      return sourceNode ? (height / 2) : 0;
    })
    .attr('x2', d => {
      const targetNode = nodes.find(n => n.id === d.target);
      return targetNode ? (width / 2 + 100) : 0;
    })
    .attr('y2', d => {
      const targetNode = nodes.find(n => n.id === d.target);
      return targetNode ? (height / 2) : 0;
    });
    
  
  const radius = Math.min(width, height) / 3;
  const angleStep = (2 * Math.PI) / nodes.length;
  nodes.forEach((node, i) => {
    node.x = width / 2 + radius * Math.cos(angleStep * i);
    node.y = height / 2 + radius * Math.sin(angleStep * i);
  });
  
  node.attr('transform', d => `translate(${d.x - 70}, ${d.y - 30})`);
  
  linkText
    .attr('x', d => (width / 2))
    .attr('y', d => (height / 2));
  
  
  simulation.nodes(nodes).on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node.attr('transform', d => `translate(${d.x - 70}, ${d.y - 30})`);
    
    linkText
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2);
  });
  
  simulation.force('link').links(links);
  
  
  for (let i = 0; i < 20; i++) {
    simulation.tick();
  }
  
  
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);
  
  node.attr('transform', d => `translate(${d.x - 70}, ${d.y - 30})`);
  
  linkText
    .attr('x', d => (d.source.x + d.target.x) / 2)
    .attr('y', d => (d.source.y + d.target.y) / 2);
  
  
  function startPan (event) {
    if (event.button === 0) { 
      isPanning.value = true;
      lastMousePosition.value = { x: event.clientX, y: event.clientY };
      svg.style('cursor', 'grabbing');
    }
  }
  
  function pan (event) {
    if (isPanning.value) {
      const dx = event.clientX - lastMousePosition.value.x;
      const dy = event.clientY - lastMousePosition.value.y;
      
      panPosition.value = {
        x: panPosition.value.x + dx,
        y: panPosition.value.y + dy
      };
      
      mainGroup.attr('transform', `translate(${panPosition.value.x}, ${panPosition.value.y}) scale(${zoomLevel.value})`);
      lastMousePosition.value = { x: event.clientX, y: event.clientY };
    }
  }
  
  function endPan () {
    isPanning.value = false;
    svg.style('cursor', 'move');
  }
  
  
  function dragstarted (event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  function dragged (event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  function dragended (event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
}

function zoomIn () {
  zoomLevel.value += 0.1;
  renderDiagram();
}

function zoomOut () {
  zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1);
  renderDiagram();
}

function resetZoom () {
  zoomLevel.value = 1;
  panPosition.value = { x: 0, y: 0 };
  renderDiagram();
}


watch(() => props.isOpen, async (newValue) => {
  if (newValue) {
    loading.value = true;
    await refreshDiagram();
    
    
    nextTick(() => {
      
      setTimeout(() => {
        if (relationships.value.length > 0) {
          renderDiagram();
          setupWheelZoom();
        }
        loading.value = false;
      }, 100);
    });
  } else {
    
    if (svgContainer.value) {
      svgContainer.value.removeEventListener('wheel', handleWheel);
    }
  }
});


watch(() => focusTable.value, () => {
  renderDiagram();
});


onMounted(() => {
  
  const resizeObserver = new ResizeObserver(() => {
    if (props.isOpen && relationships.value.length > 0 && svgContainer.value) {
      renderDiagram();
    }
  });
  
  
  watch(() => svgContainer.value, (newVal) => {
    if (newVal) {
      resizeObserver.observe(newVal);
    }
  });
  
  
  onUnmounted(() => {
    if (svgContainer.value) {
      resizeObserver.unobserve(svgContainer.value);
      svgContainer.value.removeEventListener('wheel', handleWheel);
    }
    resizeObserver.disconnect();
  });
});


function setupWheelZoom () {
  if (!svgContainer.value) return;
  
  
  svgContainer.value.removeEventListener('wheel', handleWheel);
  
  
  svgContainer.value.addEventListener('wheel', handleWheel);
}


function handleWheel (event) {
  event.preventDefault();
  
  
  const isZoomIn = event.deltaY < 0;
  
  
  if (isZoomIn) {
    zoomLevel.value += 0.1;
  } else {
    zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1);
  }
  
  
  renderDiagram();
}


function onModalFullyOpen () {
  if (relationships.value.length > 0 && svgContainer.value) {
    console.log('Modal fully opened, rendering diagram');
    renderDiagram();
    setupWheelZoom();
  }
}


async function onRefreshClick () {
  loading.value = true;
  await refreshDiagram();
  nextTick(() => {
    if (relationships.value.length > 0) {
      renderDiagram();
      setupWheelZoom();
    }
    loading.value = false;
  });
}
</script>

<style scoped>
.modal-box {
  width: 90%;
  max-width: 1200px;
}

.diagram-container {
  min-height: 500px;
  position: relative;
  background-color: #1a1a1a;
  border-radius: 8px;
}

.diagram-svg-container {
  width: 100%;
  height: 500px;
  overflow: auto;
}

.diagram-controls {
  position: relative;
  z-index: 2;
  padding: 8px;
}

.info-panel {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(40, 40, 40, 0.8);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  color: #ccc;
  max-width: 200px;
  z-index: 10;
}

.badge.badge-warning {
  background-color: #F59E0B;
  color: #000;
}

.badge.badge-success {
  background-color: #10B981;
  color: #fff;
}

:deep(.node:hover rect) {
  stroke: #4b9afa;
  stroke-width: 2px;
  cursor: pointer;
}

:deep(.node-focused rect) {
  stroke: #4b9afa;
  stroke-width: 2px;
  filter: drop-shadow(0 0 8px rgba(75, 154, 250, 0.5));
}
</style> 