<script setup lang="ts">
/**
 * @component
 * Show the structure of the loaded project and makes possible to edit it.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-03-10
 */
import {computed, ref} from "vue";
import {VueFlow, type Node, type Edge, Position, useVueFlow, ConnectionMode, ConnectionLineType,
        Panel, MarkerType, type GraphEdge, type Connection} from "@vue-flow/core";
import {VueDraggable, type SortableEvent} from "vue-draggable-plus";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {closeWithEscape} from "@/services/CaptureEscape";
import {theme} from "@/services/ReceiveTheme";
import type {ClientProjectInfo, OneNodeInfo, ProjectInfo} from "@/types/NodeInfo";
import type {ProjectGraph} from "@/types";
import SpecialNode from "./SpecialNode.vue";

/** The loaded project graph */
let graph: ClientProjectInfo;

/**
 * An entry of the sortable lists
 * @notExported
 */
interface SortableListEntry {

    /** The title of the node */
    name: string;
    /** The id of the node */
    id: string;
    /** Type of the node */
    type: string;
    /** The node has been created from the list of all nodes */
    isNew: boolean;
    /** The node has been selected */
    selected: boolean;
    /** Input of the node */
    in: string;
    /** Graphic of the node */
    graphic: string;
}

/** Sortable lists */
const listLeft = ref<SortableListEntry[]>([]);  // Contains the project nodes
const listRight = ref<SortableListEntry[]>([]); // Contains all the available nodes

/** Data on the selected node */
const infoContent = ref<{label: string; value: string}[]>([]);
const selectedId = ref("");
const selectedIdx = ref(0);
const selectedLabel = ref("");
const selectedInput = ref("");
const disableNodeChange = ref(true);

/** All the available nodes */
const allAvailableNodes = ref<OneNodeInfo[]>([]);

// TEST Graph description
/** The graph description for the Vue Flow graph editor */
interface GraphFlowItem {

	/** ID of the node */
	id: string;

    /** The label that appears on the node selector */
    label: string;

	/** Node id from which the node takes input. If none, it is the empty string */
	in: string;

    /** True if the node accepts inputs */
    hasInput: boolean;

	/** True if the node send a structure down the pipeline */
	hasOutput: boolean;

	/** "out": generates graphical output, "in": the viewer, "none": is pure computation */
	graphic: "none" | "in" | "out";

	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

    /** Node position on the graph */
    position: {x: number; y: number};
}

/** Graph node additional data */
interface NodeData {
    /** The label that appears on the node selector */
    label: string;
	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
    type: string;
	/** Node id from which the node takes input. If none, it is the empty string */
    in: string;
    /** If generates or accepts graphical output */
    graphic: string;
}

/** The graph in format accepted by the graph editor */
const graphFlow = ref<GraphFlowItem[]>([]);

// Spacing between nodes in the diagonal default layout
const X_INCREMENT = 150;
const Y_INCREMENT = 70;

/**
 * Format graph data for the editor
 *
 * @param projectInfo - Project data from the main process
 */
const prepareGraphFlow = (projectInfo: ProjectInfo): void => {

    let x = 5;
    let y = 5;

    graphFlow.value.length = 0;
    for(const item in projectInfo.graph) {

        const node = projectInfo.graph[item];

        let hasOutput = false;
        let hasInput = false;
        let graphic: "none" | "in" | "out" = "none";
        for(const all of projectInfo.allNodes) {
            if(all.type === node.type) {
                hasInput = all.in;
                hasOutput = all.out;
                graphic = all.graphic;
                break;
            }
        }
        graphFlow.value.push({
            id: item,
            label: node.label,
            in: node.in,
            hasInput,
            hasOutput,
            graphic,
            type: node.type,
            position: {x, y}
        });

        x += X_INCREMENT;
        y += Y_INCREMENT;
    }
};

/** Receive the data and build the node lists */
receiveInWindow((data) => {

    const info = JSON.parse(data) as ProjectInfo;
    graph = info.graph;

    prepareGraphFlow(info);

    allAvailableNodes.value = info.allNodes;

    // Build the list of available nodes (right list)
    listRight.value.length = 0;
    for(const entry of info.allNodes) {

        // Don't list the viewer node
        if(entry.graphic === "in") continue;

        // Transform the type into a readable string
        const entryType = entry.type;
        const label = entryType[0].toUpperCase() + entryType.slice(1).replaceAll("-", " ");

        // Assign a unique id to the node
        let prefixSequence = 1;
        let id = entry.idPrefix + prefixSequence.toString();
        while(id in graph) {
            ++prefixSequence;
            id = entry.idPrefix + prefixSequence.toString();
        }

        // Fill the list of available nodes
        listRight.value.push({
            name: label,
            id,
            type: entry.type,
            isNew: true,
            selected: false,
            in: "",
            graphic: entry.graphic
        });
    }
    listRight.value.sort((a, b) => a.name.localeCompare(b.name));

    // Prepare the list of project nodes (left list)
    listLeft.value.length = 0;
    for(const node in graph) {

        // Find the entry in all nodes and grab the graphic entry
        let graphic = "none";
        for(const entry of allAvailableNodes.value) {
            if(entry.type === graph[node].type) {
                graphic = entry.graphic;
                break;
            }
        }

        listLeft.value.push({
            name: graph[node].label,
            id: node,
            type: graph[node].type,
            isNew: false,
            selected: false,
            in: graph[node].in,
            graphic
        });
    }
});

/** Close the window on Esc press */
closeWithEscape("/editor");

/** If the project has been modified */
const projectModified = ref(false);

/** List of nodes from which the input could be taken */
const inputFromOther = computed(() => {

    // If has no input
    const editedNodeType = listLeft.value[selectedIdx.value].type;
    if(allAvailableNodes.value.some((item) => item.type === editedNodeType && !item.in)) return [];

    // All nodes that have an input
    const nodesWithOut = allAvailableNodes.value.filter((item) => item.out);

    const out = [];
    for(const entry of listLeft.value) {

        for(const node of nodesWithOut) {
            if(node.type === entry.type && entry.id !== selectedId.value) {
                out.push({label: entry.name, id: entry.id});
            }
        }
    }

    return out;
});

/**
 * Save the modified project
 */
const saveModifiedProject = (): void => {

    if(!projectModified.value) return;
    projectModified.value = false;

    // Fill the graph
    const graph: ProjectGraph = {};

    for(const entry of listLeft.value) {

        graph[entry.id] = {
            label: entry.name,
            type: entry.type,
            in: entry.in
        };
    }

    sendToNode("SYSTEM", "modified-project", {
        projectModified: JSON.stringify(graph)
    });
};

/**
 * Check if the id is in use on the left side and return an unique id
 *
 * @param id - Id to check
 * @returns An unique id
 */
const makeIdUnique = (id: string): string => {

    let found = true;
    let seq = 1;
    // eslint-disable-next-line sonarjs/slow-regex
    const prefix = id.replace(/\d+$/, "");
    while(found) {
        found = false;
        id = `${prefix}${seq}`;
        for(const entry of listLeft.value) {
            if(entry.id === id) {
                ++seq;
                found = true;
                break;
            }
        }
        if(!found) break;
    }
    return id;
};

/**
 * Clone the element when dragged from right to left list
 *
 * @param element - The element to clone
 * @returns A clone of the element with an unique id
 */
const clone = (element: SortableListEntry): SortableListEntry => {

    const id = makeIdUnique(element.id);
    return {
        name: `${element.name} (${id})`,
        id,
        type: element.type,
        isNew: true,
        selected: false,
        in: element.in,
        graphic: element.graphic
    };
};

/**
 * The list has been modified
 */
const onModified = (): void => {
    projectModified.value = true;
};

/**
 * Select or deselect an element in the left list
 *
 * @param index - Index of the element in the left list
 */
const selectItem = (index: number): void => {

    const len = listLeft.value.length;
    for(let i=0; i < len; ++i) {
        listLeft.value[i].selected = (i === index) ? !listLeft.value[i].selected : false;
    }

    // Fill and show the info section
    const node = listLeft.value[index];
    infoContent.value.length = 0;
    if(!node.selected) return;
    infoContent.value.push(
        {label: "Node id:",    value: node.id},
        {label: "Label:",      value: node.name},
        {label: "Node type:",  value: node.type},
        {label: "Input from:", value: node.in},
        {label: "Graphics:",   value: node.graphic},
    );

    // The id of the selected node
    selectedIdx.value = index;
    selectedId.value = node.id;
    selectedLabel.value = node.name;
    selectedInput.value = node.in;
};

/**
 * Immediately remove an element dropped on the right list
 *
 * @param entry - Element dropped on the right list
 */
const onDropRight = (entry: SortableEvent): void => {

    listRight.value.splice(entry.newIndex!, 1);
};

/**
 * Apply changes to the selected node
 */
const saveEditedNode = (): void => {

    projectModified.value = true;
    disableNodeChange.value = true;

    listLeft.value[selectedIdx.value].name = selectedLabel.value;
    listLeft.value[selectedIdx.value].in = selectedInput.value;
    infoContent.value[1].value = selectedLabel.value;
    infoContent.value[3].value = selectedInput.value;
};

/**
 * Restore the node to the initial project content
 */
const restoreEditedNode = (): void => {

    const node = graph[selectedId.value];

    listLeft.value[selectedIdx.value].name = node.label;
    listLeft.value[selectedIdx.value].in = node.in;
    infoContent.value[1].value = node.label;
    infoContent.value[3].value = node.in;

    selectedLabel.value = node.label;
    selectedInput.value = node.in;

    disableNodeChange.value = true;
};

/**
 * Enable change node button only when values have changed
 */
const nodeChanged = (): void => {

    disableNodeChange.value = false;
};

// TEST VueFlow
const {onNodesChange, onEdgesChange, updateNode, findNode, findEdge, updateEdge} = useVueFlow();
const needPanel = ref(false);
const nodeInfo = ref<{label: string; value: string}[]>([]);

/** Listen to node selection */
let x = 0;
let y = 0;
onNodesChange((changes) => {

    let showPanel = 0;
    for(const change of changes) {

        if(change.type === "position") {
            if(change.position) {
                x = change.position.x;
                y = change.position.y;
            }
            else {
                for(const node of graphFlow.value) {
                    if(node.id === change.id) {
                        node.position.x = x;
                        node.position.y = y;
                    }
                }
            }
        }
        else if(change.type === "select") {
            if(change.selected) {

                const node = findNode<NodeData>(change.id);
                nodeInfo.value.length = 0;
                if(node) {
                    nodeInfo.value.push(
                        {label: "Node id:",    value: change.id},
                        {label: "Label:",      value: node.data.label},
                        {label: "Node type:",  value: node.data.type},
                        {label: "Input from:", value: node.data.in},
                        {label: "Graphics:",   value: node.data.graphic}
                    );
                }
                updateNode(change.id, {style: {backgroundColor: "#BFBF00"}});
                showPanel += 1;
            }
            else {
                updateNode(change.id, {style: {backgroundColor: "white"}});
                showPanel += 2;
            }
        }
    }
    if(showPanel > 0) needPanel.value = showPanel !== 2;
});

onEdgesChange((changes) => {
    console.log("EDGE", changes);
    for(const change of changes) {
        if(change.type === "select") {
            const edge = findEdge(change.id);
            // const {style} = edge;
            // edge!.style!.stroke = change.selected ? "red" : "#B1B1B7";
            // console.log(edge);
            // updateEdge(edge)
            // for(const edge of)
            edge!.class = change.selected ? "edge-selected" : "";
        }
    }
});

// These are our nodes
const nodes = computed<Node<NodeData>[]>(() => {

    const nodes: Node<NodeData>[] = [];
    for(const graphNode of graphFlow.value) {

        let type = "default";
        if(graphNode.hasInput && !graphNode.hasOutput) type = "output";
        else if(!graphNode.hasInput && graphNode.hasOutput) type = "input";
        else if(!graphNode.hasInput && !graphNode.hasOutput) type = "none";

        const out: Node<NodeData> = {
            id: graphNode.id,
            position: graphNode.position,
            data: {
                label: graphNode.label,
                graphic: graphNode.graphic,
                type: graphNode.type,
                in: graphNode.in
            },
            type,
            targetPosition: Position.Left,
            sourcePosition: Position.Right,
            width: 100
        };
        nodes.push(out);
    }
    return nodes;
});

// These are our edges
const edges = computed<Edge[]>(() => {

    const edges: Edge[] = [];
    for(const graphNode of graphFlow.value) {

        if(graphNode.in) {
            const out: Edge = {
                id: `${graphNode.in}->${graphNode.id}`,
                source: graphNode.in,
                target: graphNode.id,
                markerEnd: MarkerType.ArrowClosed,
                type: ConnectionLineType.SmoothStep,
                style: {strokeWidth: 2, filter: "drop-shadow(1px 1px 1px black) drop-shadow(1px -1px 1px black) drop-shadow(-1px 1px 1px black) drop-shadow(-1px -1px 1px black)"}

            };
            edges.push(out);
        }
    }
    return edges;
});

/** Type of the onEdgeUpdate parameters */
interface EdgeUpdateParams {
    /** Edge before update */
    edge: GraphEdge;
    /** Updated connection */
    connection: Connection;
}

/**
 * Handler for the edge move from a terminal to another
 *
 * @param params - Parameters from the edge updated call
 */
const onEdgeUpdate = (params: EdgeUpdateParams): void => {

    const {edge, connection} = params;
    console.log("ONEDGEUPD", edge, connection);
    updateEdge(edge as GraphEdge, connection as Connection);
};

/**
 * Create a connection
 *
 * @param params - Connection created
 */
const onConnect = (params: Connection): void => {

    let nodeSource: GraphFlowItem | undefined;
    let nodeTarget: GraphFlowItem | undefined;
    for(const graphNode of graphFlow.value) {
        if(graphNode.id === params.source) {
            nodeSource = graphNode;
        }
        else if(graphNode.id === params.target) {
            nodeTarget = graphNode;
        }
    }
    if(!nodeSource || !nodeTarget) return;

    nodeTarget.in = nodeTarget.in === params.source ? "" : params.source;
};

interface GraphNodeNew {
    label: string;
    type: string;
    x: number;
    y: number;
    in?: string;
}
type ProjectGraphNew = Record<string, GraphNodeNew>;

const saveFlowGraph = (): void => {

    const project: ProjectGraphNew = {};
    for(const node of graphFlow.value) {
        project[node.id] = {
            label: node.label,
            type: node.type,
            x: Math.round(node.position.x),
            y: Math.round(node.position.y)
        };
        if(node.in !== "") project[node.id].in = node.in;
        project[node.id].x = Math.round(node.position.x);
        project[node.id].y = Math.round(node.position.y);
    }

    console.log(JSON.stringify(project, undefined, 2));
};

const handleDrop = (event: DragEvent): void => {
    const nodeType = event.dataTransfer?.getData("node");
    console.log("Handle drop", nodeType);
};
const handleDragOver = (event: DragEvent): void => {
    console.log("Handle drag over", event);
    event.preventDefault();

  if(event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
};

const handleDragStart = (event: DragEvent, nodeType: string): void => {
    console.log("Drag start", event, nodeType);
    event.dataTransfer?.setData("node", nodeType);
};
</script>


<template>
<v-app :theme>
  <div class="program-editor-container">
    <div class="tl"><v-label class="column-title">Current project</v-label></div>
    <div class="tc"><v-label class="column-title">Available nodes</v-label></div>
    <div class="tr"><v-label class="column-title">Node info</v-label></div>
    <div class="cl">
      <vue-draggable
        v-model="listLeft"
        :animation="150"
        ghostClass="ghost"
        group="nodes"
        filter=".filtered"
        @update="onModified"
        @add="onModified"
        @remove="onModified">
        <div v-for="(item, index) in listLeft" :key="item.id"
              class="list-item"
              :class="{itemSelected: item.selected, filtered: item.type === 'viewer-3d'}"
              @click="selectItem(index)">
          {{ item.name }}
        </div>
      </vue-draggable>
    </div>
    <div class="cc">
      <vue-draggable
        v-model="listRight"
        :animation="150"
        :group="{name: 'nodes', pull: 'clone', put: true, revertClone: true}"
        :sort="false"
        :clone
        ghostClass="ghost"
        @add="onDropRight">
        <div v-for="item in listRight" :key="item.id" class="list-item">
          {{ item.name }}
        </div>
      </vue-draggable>
      <div draggable
      @dragstart="handleDragStart($event, 'someNode')">Test</div>
    </div>
    <div v-if="infoContent.length > 0" class="cr">
      <v-table class="pa-3 mr-5" density="comfortable">
        <tr v-for="i of infoContent" :key="i.label">
          <td class="w-25">{{ i.label }}</td>
          <td>{{ i.value }}</td>
        </tr>
      </v-table>
      <v-container class="pl-0 pr-5 mt-2">
        <v-label class="column-title">Edit node</v-label>
        <v-text-field v-model="selectedLabel"
                  label="Node label" class="mt-4"
                  hide-details="auto" @update:modelValue="nodeChanged"
                  clearable spellcheck="false" />
        <v-select v-if="inputFromOther.length > 0" v-model="selectedInput" :items="inputFromOther"
                  item-title="label" item-value="id" label="Input from" @update:modelValue="nodeChanged"
                  variant="solo-filled" hide-details class="mt-4" />
        <v-container class="pl-0">
          <v-btn v-focus @click="restoreEditedNode" class="mr-2 ml-auto">Reset</v-btn>
          <v-btn :disabled="disableNodeChange" @click="saveEditedNode">Change node</v-btn>
        </v-container>
      </v-container>
    </div>
    <div class="vv" @drop="handleDrop"
                    @dragover="handleDragOver">
      <!-- TBD Graph -->
      <VueFlow :nodes :edges fit-view-on-init
                edges-updatable
                :connection-mode="ConnectionMode.Strict"
                :connection-radius="30"
                @edge-update="onEdgeUpdate"
                @connect="onConnect">
        <Panel v-if="needPanel" position="top-right">
          <table class="w-100">
            <tr v-for="i of nodeInfo" :key="i.label">
              <td style="width: 30%">{{ i.label }}</td>
              <td>{{ i.value }}</td>
            </tr>
          </table>
        </Panel>
        <!-- bind your custom node type to a component by using slots,
             slot names are always `node-<type>` auto-connect-->
        <template #node-none="specialNodeProps">
          <SpecialNode v-bind="specialNodeProps" />
        </template>

        <!-- bind your custom edge type to a component by using slots,
             slot names are always `edge-<type>`
        <template #edge-special="specialEdgeProps">
          <SpecialEdge v-bind="specialEdgeProps" />
        </template> -->
      </VueFlow>
    </div>
    <div class="bb button-strip pr-7">
      <v-btn @click="saveFlowGraph">Test save graph</v-btn>
      <v-btn :disabled="!projectModified" @click="saveModifiedProject">Save modified project</v-btn>
      <v-btn v-focus @click="closeWindow('/editor')">Close</v-btn>
    </div>
  </div>
</v-app>
</template>


<style>
/* these are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";

/* this contains the default theme, these are optional styles */
@import "@vue-flow/core/dist/theme-default.css";

.program-editor-container {
  display: grid;
  gap: 0 10px;
  grid-auto-flow: row;
  grid-template:
    "tl tc tr vv" 3rem
    "cl cc cr vv" 1fr
    "bb bb bb bb" auto / 300px 250px 400px 1fr;
  width: 100vw;
  height: 100vh;
  padding: 10px 10px 10px 15px;
}

.tl {grid-area: tl;}
.tc {grid-area: tc;}
.tr {grid-area: tr;}
.cl {grid-area: cl; overflow-y: auto;}
.cc {grid-area: cc; overflow-y: auto;}
.cr {grid-area: cr; margin-right: 0;}
.bb {grid-area: bb; padding: 10px 20px 0 0;}
.vv {grid-area: vv; margin-right: 30px; border: 1px solid light-dark(#808080, #B3B3B3);}

.ghost {
  background-color: #BFBF00CD;
}

.itemSelected {
  border: 1px solid #BFBF00CD !important;
}

.list-item {
  border: 1px solid transparent;
  user-select: none;
  cursor: move;
}

.vue-flow__panel {
  background-color:#2d3748;
  border-radius: 8px;
  padding: 7px;
  margin-right: 10px;
  width: 350px;
}

.edge-selected {
    stroke: red !important
}
</style>
