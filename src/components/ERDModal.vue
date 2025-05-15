<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch } from 'vue';
  import Modal from '@/components/Modal.vue';
  import { useDatabaseSchema } from '@/services/databaseSchema';
  import cytoscape from 'cytoscape';
  import coseBilkent from 'cytoscape-cose-bilkent';

  cytoscape.use(coseBilkent);

  const props = defineProps<{
    show: boolean;
  }>();

  const emit = defineEmits(['close']);

  const { databaseSchema, isLoading, error, fetchDatabaseSchema } = useDatabaseSchema();
  const erdContainer = ref<HTMLElement | null>(null);
  const cy = ref<any>(null);
  const isLoadingGraph = ref(false);
  const selectedNode = ref<string | null>(null);
  const tooltipTimeout = ref<number | null>(null);

  const handleClose = () => {
    emit('close');
  };

  const getSchemaGraph = () => {
    if (
      !databaseSchema.value ||
      !databaseSchema.value.tables ||
      databaseSchema.value.tables.length === 0
    ) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];

    for (const table of databaseSchema.value.tables) {
      nodes.push({
        data: {
          id: table.name,
          label: table.model ? table.model.name : table.name,
          columns: table.columns.map(c => ({
            name: c.name,
            type: c.type,
            primary: c.primary_key,
            foreign: c.foreign_key,
          })),
        },
      });
    }

    for (const table of databaseSchema.value.tables) {
      if (table.foreignKeys && table.foreignKeys.length > 0) {
        for (const fk of table.foreignKeys) {
          if (fk.referenced_table) {
            edges.push({
              data: {
                id: `${table.name}-${fk.column}-${fk.referenced_table}-${fk.referenced_column}`,
                source: table.name,
                target: fk.referenced_table,
                label: fk.column,
              },
            });
          }
        }
      }
    }

    return { nodes, edges };
  };

  const initCytoscape = () => {
    if (!erdContainer.value) return;

    isLoadingGraph.value = true;

    const { nodes, edges } = getSchemaGraph();

    if (nodes.length === 0) {
      isLoadingGraph.value = false;
      return;
    }

    cy.value = cytoscape({
      container: erdContainer.value,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#4b5563',
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            color: '#ffffff',
            'text-outline-width': 1,
            'text-outline-color': '#374151',
            'font-size': '12px',
            width: '180px',
            height: '40px',
            shape: 'roundrectangle',
            'text-wrap': 'ellipsis',
            'text-max-width': '170px',
          },
        },
        {
          selector: 'node.selected',
          style: {
            'background-color': '#3b82f6',
            'border-width': 2,
            'border-color': '#2563eb',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'node.related',
          style: {
            'background-color': '#6366f1',
            'border-width': 1,
            'border-color': '#4f46e5',
          },
        },
        {
          selector: 'node.faded',
          style: {
            opacity: 0.25,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#9ca3af',
            'target-arrow-color': '#9ca3af',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '10px',
            color: '#4b5563',
            'font-weight': 'normal',
            'text-background-color': '#f3f4f6',
            'text-background-opacity': 0.7,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge.related',
          style: {
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
            width: 3,
            color: '#1e40af',
            'font-weight': 'bold',
            'text-background-color': '#dbeafe',
            'text-background-opacity': 0.9,
            'z-index': 999,
          },
        },
        {
          selector: 'edge.faded',
          style: {
            opacity: 0.25,
          },
        },
      ],
      layout: {
        name: 'cose-bilkent',
      },
    });

    cy.value.on('tap', 'node', (event: any) => {
      const nodeId = event.target.id();

      if (selectedNode.value === nodeId) {
        clearNodeSelection();
      } else {
        selectedNode.value = nodeId;
        highlightNodeAndConnections(nodeId);
      }
    });

    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'cy-tooltip';
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.zIndex = '1000';
    tooltipEl.style.backgroundColor = 'white';
    tooltipEl.style.padding = '10px';
    tooltipEl.style.borderRadius = '6px';
    tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.pointerEvents = 'all';
    tooltipEl.style.display = 'none';
    tooltipEl.style.maxWidth = '280px';
    tooltipEl.style.top = '0';
    tooltipEl.style.left = '0';
    document.body.appendChild(tooltipEl);

    cy.value.on('mouseover', 'node', (event: any) => {
      const node = event.target;
      const columns = node.data('columns');

      if (columns && columns.length > 0) {
        const primaryKeys = columns.filter((c: any) => c.primary).map((c: any) => c.name);
        const foreignKeys = columns.filter((c: any) => c.foreign).map((c: any) => c.name);

        let tooltip = `<strong>${node.data('label')}</strong><br>`;
        tooltip += '<hr style="margin: 3px 0">';

        if (primaryKeys.length > 0) {
          tooltip += `<span style="color: #f59e0b">PK: ${primaryKeys.join(', ')}</span><br>`;
        }

        if (foreignKeys.length > 0) {
          tooltip += `<span style="color: #3b82f6">FK: ${foreignKeys.join(', ')}</span><br>`;
        }

        tooltip += '<hr style="margin: 3px 0">';
        tooltip += '<div style="max-height: 150px; overflow-y: auto">';
        columns.forEach((col: any) => {
          let colStr = `${col.name}: ${col.type}`;
          tooltip += `<div>${colStr}</div>`;
        });
        tooltip += '</div>';

        tooltipEl.innerHTML = tooltip;
        tooltipEl.style.display = 'block';

        positionTooltip(node);

        if (tooltipTimeout.value !== null) {
          clearTimeout(tooltipTimeout.value);
          tooltipTimeout.value = null;
        }
      }
    });

    const positionTooltip = (node: any) => {
      if (!erdContainer.value) return;

      const renderedPosition = node.renderedPosition();
      const containerBounds = erdContainer.value.getBoundingClientRect();
      tooltipEl.style.left = containerBounds.left + renderedPosition.x + 90 + 'px';
      tooltipEl.style.top = containerBounds.top + renderedPosition.y - 80 + 'px';
    };

    cy.value.on('mousemove', 'node', (event: any) => {
      if (tooltipEl.style.display === 'block') {
        positionTooltip(event.target);
      }
    });

    cy.value.on('mouseout', 'node', () => {
      tooltipTimeout.value = window.setTimeout(() => {
        tooltipEl.style.display = 'none';
      }, 300);
    });

    tooltipEl.addEventListener('mouseenter', () => {
      if (tooltipTimeout.value !== null) {
        clearTimeout(tooltipTimeout.value);
        tooltipTimeout.value = null;
      }
    });

    tooltipEl.addEventListener('mouseleave', () => {
      tooltipEl.style.display = 'none';
    });

    cy.value.on('tap', (event: any) => {
      if (event.target === cy.value) {
        clearNodeSelection();
      }
    });

    isLoadingGraph.value = false;
  };

  const highlightNodeAndConnections = (nodeId: string) => {
    if (!cy.value) return;

    cy.value.elements().removeClass('selected related faded');

    const node = cy.value.$id(nodeId);

    const connectedEdges = node.connectedEdges();
    const connectedNodes = connectedEdges.connectedNodes().filter((n: any) => n.id() !== nodeId);

    node.addClass('selected');
    connectedNodes.addClass('related');
    connectedEdges.addClass('related');

    cy.value
      .elements()
      .difference(node)
      .difference(connectedNodes)
      .difference(connectedEdges)
      .addClass('faded');
  };

  const clearNodeSelection = () => {
    if (!cy.value) return;

    selectedNode.value = null;
    cy.value.elements().removeClass('selected related faded');
  };

  const resetSelection = () => {
    clearNodeSelection();
  };

  const refreshLayout = () => {
    if (cy.value) {
      cy.value
        .layout({
          name: 'cose-bilkent',
        })
        .run();
    }
  };

  const zoomIn = () => {
    if (cy.value) {
      const currentZoom = cy.value.zoom();
      cy.value.zoom(currentZoom * 1.2);
    }
  };

  const zoomOut = () => {
    if (cy.value) {
      const currentZoom = cy.value.zoom();
      cy.value.zoom(currentZoom * 0.8);
    }
  };

  const fitGraph = () => {
    if (cy.value) {
      cy.value.fit();
    }
  };

  watch(
    () => props.show,
    async newVal => {
      if (newVal) {
        if (!databaseSchema.value || databaseSchema.value.tables.length === 0) {
          await fetchDatabaseSchema(true);
        }

        selectedNode.value = null;

        setTimeout(() => {
          initCytoscape();
        }, 100);
      } else {
        document.querySelectorAll('#cy-tooltip').forEach(el => el.remove());
      }
    }
  );

  onMounted(async () => {
    if (props.show) {
      if (!databaseSchema.value || databaseSchema.value.tables.length === 0) {
        await fetchDatabaseSchema(true);
      }

      setTimeout(() => {
        initCytoscape();
      }, 100);
    }
  });

  onUnmounted(() => {
    if (cy.value) {
      cy.value.destroy();
      cy.value = null;
    }

    document.querySelectorAll('#cy-tooltip').forEach(el => el.remove());

    if (tooltipTimeout.value !== null) {
      clearTimeout(tooltipTimeout.value);
      tooltipTimeout.value = null;
    }
  });
</script>

<template>
  <Modal
    :show="show"
    title="Database Entity-Relationship Diagram"
    width="max-w-[90%]"
    :z-index="50"
    @close="handleClose"
    :show-action-button="false"
    :show-footer="false"
  >
    <div class="flex h-[80vh] flex-col space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm opacity-70">Visualize your database tables and their relationships</div>
        <div class="flex space-x-2">
          <button @click="zoomIn" class="btn btn-sm btn-ghost">
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button @click="zoomOut" class="btn btn-sm btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
          <button @click="fitGraph" class="btn btn-sm btn-ghost">
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
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              />
            </svg>
          </button>
          <button @click="refreshLayout" class="btn btn-sm btn-ghost">
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
            @click="resetSelection"
            class="btn btn-sm"
            :class="{ 'btn-ghost': !selectedNode, 'btn-primary': selectedNode }"
            :disabled="!selectedNode"
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
            <span class="ml-1 text-xs">Reset</span>
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="flex flex-1 items-center justify-center">
        <div class="flex flex-col items-center">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-4 text-sm opacity-70">Loading database schema...</p>
        </div>
      </div>

      <div v-else-if="error" class="flex flex-1 items-center justify-center">
        <div class="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ error }}</span>
        </div>
      </div>

      <div v-else-if="isLoadingGraph" class="flex flex-1 items-center justify-center">
        <div class="flex flex-col items-center">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-4 text-sm opacity-70">Building entity-relationship diagram...</p>
        </div>
      </div>

      <div
        v-else-if="databaseSchema && databaseSchema.tables && databaseSchema.tables.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <div class="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="h-6 w-6 shrink-0 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span
            >No database tables found. Ensure your database connection is properly configured.</span
          >
        </div>
      </div>

      <div
        ref="erdContainer"
        class="border-base-300 flex-1 overflow-hidden rounded-md border"
      ></div>

      <div class="bg-base-200 rounded-md p-2 text-xs">
        <div class="mb-1 font-semibold">Legend:</div>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <div class="flex items-center">
            <div class="mr-1 h-3 w-3 rounded-sm bg-gray-600"></div>
            <span>Table/Model</span>
          </div>
          <div class="flex items-center">
            <div class="mr-1 h-3 w-3 rounded-sm bg-blue-500"></div>
            <span>Selected Table</span>
          </div>
          <div class="flex items-center">
            <div class="mr-1 h-3 w-3 rounded-sm bg-indigo-500"></div>
            <span>Related Table</span>
          </div>
          <div class="flex items-center">
            <div class="mr-1 h-3 w-3 rounded-full border border-gray-400"></div>
            <span>Relationship</span>
          </div>
          <div class="flex items-center">
            <div class="mr-1 h-3 w-3 rounded-full border border-2 border-blue-500"></div>
            <span>Active Relationship</span>
          </div>
        </div>
        <div class="mt-2 text-xs opacity-70">
          <span>Click on a table to see its relationships. Click again to deselect.</span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
  /* Ensure the Cytoscape container fills its parent for proper rendering */
  div[ref='erdContainer'] {
    min-height: 400px;
    background-color: #f8fafc;
  }
</style>
