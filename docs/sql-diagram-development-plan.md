# SQL Diagram Development Plan - Larabase

## Overview

This development plan outlines the implementation of a "Show SQL Diagram" functionality that allows users to visualize SQL queries as interactive diagrams directly from the Monaco SQL editor.

### Core Features

- Context menu integration in Monaco editor
- SQL parsing and AST analysis
- Interactive diagram generation using Cytoscape
- Support for complex JOIN relationships and subqueries
- Comprehensive error handling and edge cases

---

## Phase 1: Dependencies and Project Setup

### 1.1 Install Required Dependencies

- [ ] Install `node-sql-parser` for SQL parsing
- [ ] Verify `cytoscape` and `cytoscape-cose-bilkent` are available
- [ ] Update package.json with new dependencies

```bash
npm install node-sql-parser@latest
```

**Files to modify:**

- `package.json`

### 1.2 Verify Existing Dependencies

- [ ] Confirm `cytoscape@^3.32.0` is installed
- [ ] Confirm `cytoscape-cose-bilkent@^4.1.0` is installed
- [ ] Test Monaco editor integration points

**Expected outcome:** All required libraries are available and functional

---

## Phase 2: SQL Parser Implementation

### 2.1 Create SQL Parser Service

- [ ] Create `src/services/sqlParser.ts`
- [ ] Implement AST traversal functions
- [ ] Create node/edge extraction logic
- [ ] Handle edge cases for different SQL constructs

**Key functions to implement:**

```typescript
interface ParsedSQL {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
	errors?: string[];
}

function parseSQLToGraph(sqlText: string): ParsedSQL;
function extractTablesFromAST(ast: any): DiagramNode[];
function extractJoinsFromAST(ast: any): DiagramEdge[];
function handleSubqueries(ast: any): {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
};
function handleCTEs(ast: any): { nodes: DiagramNode[]; edges: DiagramEdge[] };
```

### 2.2 Handle SQL Parsing Edge Cases

- [ ] Invalid SQL syntax handling
- [ ] Large/complex query detection (>50 nodes)
- [ ] Queries without tables (`SELECT 1+1`)
- [ ] Queries without JOINs (isolated tables)
- [ ] `USING` clause handling
- [ ] CTE (Common Table Expression) support
- [ ] Subqueries in WHERE/HAVING clauses
- [ ] Multiple statements separated by `;`
- [ ] Polymorphic joins detection
- [ ] JSON function handling (`JSON_EXTRACT`, etc.)

**Files to create:**

- `src/services/sqlParser.ts`
- `src/types/sqlDiagram.ts`

### 2.3 Create Type Definitions

```typescript
interface DiagramNode {
	data: {
		id: string;
		label: string;
		type: 'table' | 'subquery' | 'cte';
		alias?: string;
		originalName?: string;
	};
}

interface DiagramEdge {
	data: {
		id: string;
		source: string;
		target: string;
		label: string;
		joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
	};
}
```

**Expected outcome:** Robust SQL parsing with comprehensive edge case handling

---

## Phase 3: Cytoscape Diagram Component

### 3.1 Create SqlDiagramModal Component

- [ ] Create `src/components/SqlDiagramModal.vue`
- [ ] Implement Cytoscape initialization
- [ ] Configure node and edge styling
- [ ] Add zoom/pan controls
- [ ] Implement responsive design

**Component features:**

- [ ] Modal with TailwindCSS styling
- [ ] Cytoscape container with proper sizing
- [ ] Zoom In/Out buttons
- [ ] Fit to screen functionality
- [ ] Layout refresh option
- [ ] Node click interactions
- [ ] Edge labels for JOIN conditions

### 3.2 Cytoscape Configuration

```typescript
const cytoscapeConfig = {
	style: [
		{
			selector: 'node',
			style: {
				'background-color': '#2563EB',
				label: 'data(label)',
				'text-valign': 'center',
				color: '#ffffff',
				'font-size': '12px',
				width: 'label',
				height: 'label',
				padding: '6px',
				'text-wrap': 'ellipsis',
				'text-max-width': '120px'
			}
		}
		// ... additional styles
	],
	layout: {
		name: 'cose-bilkent',
		idealEdgeLength: 100,
		nodeRepulsion: 4500
		// ... additional layout options
	}
};
```

### 3.3 Handle Rendering Edge Cases

- [ ] Duplicate node ID prevention
- [ ] Invalid ID sanitization (remove special characters)
- [ ] Long label truncation (>30 characters)
- [ ] Modal height/scroll management
- [ ] Empty diagram handling
- [ ] Performance optimization for large diagrams

**Files to create:**

- `src/components/SqlDiagramModal.vue`
- `src/utils/diagramHelpers.ts`

**Expected outcome:** Functional, responsive diagram modal with proper styling

---

## Phase 4: Monaco Editor Integration

### 4.1 Extend useSQLEditor Composable

- [ ] Add diagram generation methods to `src/composables/useSQLEditor.ts`
- [ ] Integrate SQL parser service
- [ ] Add context menu action for "Show SQL Diagram"
- [ ] Handle selected text vs full editor content

**New methods to add:**

```typescript
function addSqlDiagramAction(editor: monaco.editor.IStandaloneCodeEditor): void;
function generateSqlDiagram(sqlText: string): Promise<void>;
function extractGraphFromAST(ast: any): {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
};
function normalizeNodesAndEdges(
	nodes: DiagramNode[],
	edges: DiagramEdge[]
): { nodes: DiagramNode[]; edges: DiagramEdge[] };
```

### 4.2 Context Menu Integration

- [ ] Add "Show SQL Diagram" to Monaco context menu
- [ ] Enable only when text is selected
- [ ] Position menu item appropriately
- [ ] Handle keyboard shortcuts (optional)

```typescript
editor.addAction({
	id: 'show-sql-diagram',
	label: 'Show SQL Diagram',
	contextMenuGroupId: 'navigation',
	contextMenuOrder: 1.5,
	precondition: 'editorHasSelection',
	run: (ed) => {
		const selection = ed.getModel().getValueInRange(ed.getSelection());
		const sqlText = selection.trim() || ed.getValue().trim();
		this.generateSqlDiagram(sqlText);
	}
});
```

### 4.3 Error Handling and User Feedback

- [ ] Invalid SQL error messages
- [ ] Loading states during parsing
- [ ] Success/failure notifications
- [ ] Graceful degradation for unsupported SQL

**Files to modify:**

- `src/composables/useSQLEditor.ts`
- `src/components/SQLEditor.vue`

**Expected outcome:** Seamless integration with existing SQL editor functionality

---

## Phase 5: Component Integration and State Management

### 5.1 Update SQL Editor Views

- [ ] Modify `src/views/SQLEditorView.vue` to include diagram modal
- [ ] Add state management for diagram visibility
- [ ] Handle diagram data passing between components
- [ ] Implement proper event handling

### 5.2 State Management

```typescript
// In SQLEditorView.vue or parent component
const showDiagram = ref(false);
const diagramData = ref<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>({
	nodes: [],
	edges: []
});

function openSqlDiagramModal(data: {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
}) {
	diagramData.value = data;
	showDiagram.value = true;
}

function closeSqlDiagramModal() {
	showDiagram.value = false;
	diagramData.value = { nodes: [], edges: [] };
}
```

### 5.3 Event Bus or Props Communication

- [ ] Implement communication between SQLEditor and SqlDiagramModal
- [ ] Handle modal open/close events
- [ ] Pass diagram data efficiently
- [ ] Manage loading states

**Files to modify:**

- `src/views/SQLEditorView.vue`
- `src/components/SQLEditor.vue`

**Expected outcome:** Smooth data flow and state management

---

## Phase 6: Advanced Features and Polish

### 6.1 Advanced SQL Features Support

- [ ] DDL parsing (CREATE TABLE, ALTER TABLE)
- [ ] ERD generation from DDL statements
- [ ] Multiple statement handling
- [ ] Temporary table support
- [ ] View and materialized view handling

### 6.2 User Experience Enhancements

- [ ] Tooltip support for nodes (showing column information)
- [ ] Node click interactions (drill-down to subqueries)
- [ ] Export diagram functionality (SVG/PNG)
- [ ] Diagram layout presets
- [ ] Keyboard navigation support

### 6.3 Performance Optimization

- [ ] Lazy loading for large diagrams
- [ ] Virtual scrolling for node lists
- [ ] Debounced parsing for real-time updates
- [ ] Memory cleanup for disposed diagrams
- [ ] Caching for parsed ASTs

**Files to enhance:**

- `src/components/SqlDiagramModal.vue`
- `src/services/sqlParser.ts`
- `src/utils/diagramHelpers.ts`

**Expected outcome:** Polished, performant feature with advanced capabilities

---

## Phase 7: Testing and Documentation

### 7.1 Unit Testing

- [ ] Test SQL parser with various query types
- [ ] Test edge cases and error handling
- [ ] Test Cytoscape integration
- [ ] Test Monaco editor integration

### 7.2 Integration Testing

- [ ] Test complete workflow from editor to diagram
- [ ] Test with real-world SQL queries
- [ ] Test performance with large queries
- [ ] Test error scenarios

### 7.3 Documentation

- [ ] Update user documentation
- [ ] Add developer documentation for SQL parser
- [ ] Document supported SQL features
- [ ] Create troubleshooting guide

**Files to create:**

- `docs/sql-diagram-user-guide.md`
- `docs/sql-parser-development.md`
- Test files in appropriate test directories

**Expected outcome:** Well-tested, documented feature ready for production

---

## Development Checklist

### Pre-Development

- [ ] Review existing codebase structure
- [ ] Understand Monaco editor integration patterns
- [ ] Analyze current modal patterns in the project
- [ ] Set up development environment

### Core Implementation

- [ ] **Phase 1:** Dependencies and setup ✓
- [ ] **Phase 2:** SQL parser service implementation
- [ ] **Phase 3:** Cytoscape diagram component
- [ ] **Phase 4:** Monaco editor integration
- [ ] **Phase 5:** Component integration
- [ ] **Phase 6:** Advanced features
- [ ] **Phase 7:** Testing and documentation

### Quality Assurance

- [ ] Code review with team
- [ ] Performance testing
- [ ] Cross-platform testing (macOS, Windows, Linux)
- [ ] User acceptance testing
- [ ] Security review (if applicable)

### Deployment Preparation

- [ ] Bundle size analysis
- [ ] Production build testing
- [ ] Update changelog
- [ ] Prepare release notes

---

## Risk Assessment and Mitigation

### Technical Risks

1. **SQL Parser Limitations**
    - Risk: `node-sql-parser` may not support all SQL dialects
    - Mitigation: Implement fallback mechanisms and clear error messages

2. **Performance with Large Queries**
    - Risk: Complex queries may cause UI lag
    - Mitigation: Implement query complexity limits and progressive loading

3. **Cytoscape Rendering Issues**
    - Risk: Large diagrams may not render properly
    - Mitigation: Implement node limits and optimization strategies

### Integration Risks

1. **Monaco Editor Compatibility**
    - Risk: Context menu integration may conflict with existing features
    - Mitigation: Thorough testing with existing SQL editor functionality

2. **Electron Bundle Size**
    - Risk: Additional dependencies may increase app size
    - Mitigation: Use tree-shaking and only import necessary modules

### User Experience Risks

1. **Learning Curve**
    - Risk: Users may not understand diagram visualization
    - Mitigation: Provide clear documentation and intuitive UI design

2. **Browser Performance**
    - Risk: Complex diagrams may slow down the application
    - Mitigation: Implement performance monitoring and optimization

---

## Success Metrics

### Functional Metrics

- [ ] Successfully parse 95% of common SQL JOIN queries
- [ ] Handle all major SQL constructs (subqueries, CTEs, etc.)
- [ ] Render diagrams within 2 seconds for queries <20 tables
- [ ] Zero crashes or freezes during normal usage

### User Experience Metrics

- [ ] Context menu appears within 100ms of right-click
- [ ] Diagram modal opens within 500ms
- [ ] Users can understand diagram layout without documentation
- [ ] Feature adoption rate >30% among SQL editor users

### Technical Metrics

- [ ] Code coverage >80% for new modules
- [ ] Bundle size increase <500KB
- [ ] Memory usage stable during extended use
- [ ] Compatible with all supported Electron versions

---

## Timeline Estimate

- **Phase 1:** 1-2 days
- **Phase 2:** 3-5 days
- **Phase 3:** 2-3 days
- **Phase 4:** 2-3 days
- **Phase 5:** 1-2 days
- **Phase 6:** 3-5 days
- **Phase 7:** 2-3 days

**Total Estimated Time:** 14-23 days (depending on complexity and requirements)

---

## Conclusion

This development plan provides a comprehensive roadmap for implementing the "Show SQL Diagram" functionality in Larabase. The phased approach ensures proper testing and integration at each step, while the detailed checklists help track progress and ensure nothing is missed.

The plan prioritizes core functionality first, then adds advanced features and polish. This approach allows for early testing and feedback, reducing the risk of major issues late in development.
