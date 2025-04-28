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
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {closeWithEscape} from "@/services/CaptureEscape";
import {theme} from "@/services/ReceiveTheme";
import type {ProjectInfo, GraphicType} from "@/types/NodeInfo";
import SpecialNode from "./SpecialNode.vue";
import type {ProjectGraph} from "@/types";

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
	graphic: GraphicType;

	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

    /** Node position on the graph */
    position: {x: number; y: number};
}

/** VueFlow graph node additional data */
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

/** The graph in the format accepted by the graph editor */
const graphFlow = ref<GraphFlowItem[]>([]);

// Spacing between nodes in the diagonal default layout
const X_INCREMENT = 150;
const Y_INCREMENT = 70;

/** Available nodes */
interface AvailableNode {

    /** ID of the node */
    idPrefix: string;

    /** The label that appears on the node selector */
    label: string;

    /** True if the node accepts inputs */
    hasInput: boolean;

    /** True if the node send a structure down the pipeline */
    hasOutput: boolean;

    /** "out": generates graphical output, "in": the viewer, "none": is pure computation */
    graphic: GraphicType;

    /** The type of the node (valid values in electron/modules/ProjectManager.ts) */
    type: string;
}

/** List of available nodes */
const availableNodes = ref<AvailableNode[]>([]);

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
        let graphic: GraphicType = "none";
        for(const all of projectInfo.allNodes) {
            if(all.type === node.type) {
                hasInput = all.in;
                hasOutput = all.out;
                graphic = all.graphic;
                break;
            }
        }
        if(node.x !== undefined && node.y !== undefined) {
            x = node.x;
            y = node.y;
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

/**
 * Format available nodes list
 *
 * @param projectInfo - Project data from the main process
 */
 const prepareAvailableNodes = (projectInfo: ProjectInfo): void => {

    availableNodes.value.length = 0;
    for(const item of projectInfo.allNodes) {

        if(item.type === "viewer-3d") continue;

        const availableNode: AvailableNode = {

            idPrefix: item.idPrefix,
            label: item.type[0].toUpperCase() + item.type.slice(1).replaceAll("-", " "),
            hasInput: item.in,
            hasOutput: item.out,
            graphic: item.graphic,
            type: item.type
        };

        availableNodes.value.push(availableNode);
    }
};

/** Receive the data and build the graph data and available nodes list */
receiveInWindow((data) => {

    const info = JSON.parse(data) as ProjectInfo;

    prepareGraphFlow(info);
    prepareAvailableNodes(info);
});

/** Close the window on Esc press */
closeWithEscape("/editor");

/** If the project has been modified */
const projectModified = ref(false);

// TEST VueFlow
const {onNodesChange, onEdgesChange, updateNode, findNode,
       findEdge, updateEdge, screenToFlowCoordinate} = useVueFlow();
const needPanel = ref(false);

interface OneNodeInfo {
    id: string;
    label: string;
    value: string;
}
const nodeInfo = ref<OneNodeInfo[]>([]);

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
            projectModified.value = true;
        }
        else if(change.type === "select") {
            if(change.selected) {

                const node = findNode<NodeData>(change.id);
                nodeInfo.value.length = 0;
                if(node) {
                    nodeInfo.value.push(
                        {id: "id", label: "Node id:",    value: change.id},
                        {id: "lb", label: "Label:",      value: node.data.label},
                        {id: "ty", label: "Node type:",  value: node.data.type},
                        {id: "in", label: "Input from:", value: node.data.in},
                        {id: "gr", label: "Graphics:",   value: node.data.graphic}
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

/** Graph nodes */
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

/** Graph edges */
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
    projectModified.value = true;
};

/**
 * Compare element in node list to produce the saved graph
 *
 * @param a - First element in the node list
 * @param b - Second element in the node list
 */
const sortGraph = (a: GraphFlowItem, b: GraphFlowItem): number => {

    const dx = a.position.x - b.position.x;
    if(dx < 10 && dx > -10) {
        const dy = a.position.y - b.position.y;
        return dy;
    }
    return dx;
};

/**
 * Save the modified project
 */
const saveProjectGraph = (): void => {

    if(!projectModified.value) return;
    projectModified.value = false;

    // Sort the node left to right and top to bottom
    const sortedGraph = graphFlow.value.toSorted(sortGraph);

    const graph: ProjectGraph = {};
    for(const node of sortedGraph) {
        graph[node.id] = {
            label: node.label,
            type: node.type,
            x: Math.round(node.position.x),
            y: Math.round(node.position.y)
        };
        if(node.in !== "") graph[node.id].in = node.in;
    }

    sendToNode("SYSTEM", "modified-project", {
        projectModified: JSON.stringify(graph)
    });
};

// For node deletion
const showConfirm = ref(false);
const selectedLabel = ref("");
let selectedId = "";

/**
 * Delete the selected node
 *
 * @param node - Selected node data
 */
const deleteNode = (node: OneNodeInfo[]): void => {

    selectedId = "";
    for(const info of node) {
        if(info.id === "id") {
            selectedId = info.value;
        }
        else if(info.id === "lb") {
            selectedLabel.value = info.value;
        }
    }
    if(selectedId) showConfirm.value = true;
};

/**
 * Confirmed deletion of the selected node
 */
const confirmDeletion = (): void => {

    // Close the dialog
    showConfirm.value = false;

    for(let idx = 0; idx < graphFlow.value.length; ++idx) {
        if(graphFlow.value[idx].id === selectedId) {
            graphFlow.value.splice(idx, 1);
            projectModified.value = true;
            needPanel.value = false;
            return;
        }
    }
};

/**
 * Drop a node into the graph
 *
 * @param event - Drag event
 */
const handleDrop = (event: DragEvent): void => {

    const nodeModel = JSON.parse(event.dataTransfer?.getData("node") ?? "{}") as AvailableNode;

    let id = nodeModel.idPrefix;
    if(id === undefined) return;

    let seq = 0;
    let found = true;
    while(found) {
        found = false;
        for(const entry of graphFlow.value) {
            if(entry.id === id) {
                found = true;
                ++seq;
                id = `${nodeModel.idPrefix}${seq}`;
                break;
            }
        }
    }

    const label = `${nodeModel.label} (${id})`;

    const position = screenToFlowCoordinate({
        x: event.clientX,
        y: event.clientY,
    });

    const node: GraphFlowItem = {

        id,
        label,
        in: "",
        hasInput: nodeModel.hasInput,
        hasOutput: nodeModel.hasOutput,
        graphic: nodeModel.graphic,
        type: nodeModel.type,
        position
    };
    graphFlow.value.push(node);
};

/**
 * Enter the graph area with a node to add
 *
 * @param event - Drag event
 */
const handleDragOver = (event: DragEvent): void => {

    event.preventDefault();

    if(event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
    }
};

/**
 * Start dragging from the available nodes list
 *
 * @param event - Drag event
 * @param nodeModel - Node from the available nodes list
 */
const handleDragStart = (event: DragEvent, nodeModel: AvailableNode): void => {

    if(event.dataTransfer) {
        event.dataTransfer.setData("node", JSON.stringify(nodeModel));
        event.dataTransfer.effectAllowed = "move";
    }
};

/**
 * Update node label on the graph
 *
 * @param label - Edited label
 */
const updateLabel = (label: string): void => {

    if(!label) return;

    let id;
    for(const entry of nodeInfo.value) {
        if(entry.id === "id") {
            id = entry.value;
            break;
        }
    }
    if(!id) return;

    for(const entry of graphFlow.value) {
        if(entry.id === id) {
            entry.label = label;
            projectModified.value = true;
            break;
        }
    }
};

</script>


<template>
<v-app :theme>
  <div class="program-editor-container">
    <div class="tr"><v-label class="column-title">Available nodes</v-label></div>
    <div class="cr">
      <div v-for="item in availableNodes" :key="item.type" class="list-item"
           draggable="true" @dragstart="handleDragStart($event, item)">
        {{ item.label }}
      </div>
    </div>
    <div class="vv" @drop="handleDrop" @dragover="handleDragOver">
      <VueFlow :nodes :edges fit-view-on-init
                edges-updatable
                :connection-mode="ConnectionMode.Strict"
                :connection-radius="30"
                @edge-update="onEdgeUpdate"
                @connect="onConnect">
        <Panel v-if="needPanel" position="top-right">
          <table class="w-100">
            <tr v-for="ni of nodeInfo" :key="ni.id">
              <td class="info-line">{{ ni.label }}</td>
              <td v-if="ni.id === 'lb'">
                <v-text-field v-model="ni.value" :hide-details="true" density="compact"
                              @update:modelValue="updateLabel"/></td>
              <td v-else><v-label>{{ ni.value }}</v-label></td>
            </tr>
          </table>
          <v-btn block @click="deleteNode(nodeInfo)">Delete node</v-btn>
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
      <v-btn :disabled="!projectModified" @click="saveProjectGraph">Save modified project</v-btn>
      <v-btn v-focus @click="closeWindow('/editor')">Close</v-btn>
    </div>
  </div>

<v-dialog v-model="showConfirm">
  <v-card title="Confirm deletion" :text='`Do you want to remove the "${selectedLabel}" node?`'
          class="mx-auto no-select" elevation="16" max-width="500">
    <v-card-actions>
        <v-btn v-focus @click="showConfirm=false">Dismiss</v-btn>
        <v-btn @click="confirmDeletion">Yes</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</v-app>
</template>


<style>
/* These are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";

/* This contains the default theme, these are optional styles */
@import "@vue-flow/core/dist/theme-default.css";

.program-editor-container {
  display: grid;
  gap: 0 10px;
  grid-auto-flow: row;
  grid-template:
    "tr vv" 3rem
    "cr vv" 1fr
    "bb bb" auto / 250px 1fr;
  width: 100vw;
  height: 100vh;
  padding: 10px 10px 10px 15px;
}

.tr {grid-area: tr; margin-left: 10px;}
.cr {grid-area: cr; margin-right: 0; margin-left: 10px; overflow-y: auto;}
.bb {grid-area: bb; padding: 10px 20px 0 0;}
.vv {grid-area: vv; margin-right: 30px; border: 1px solid light-dark(#808080, #B3B3B3);}

.list-item {
  border: 1px solid transparent;
  user-select: none;
  cursor: move;
}

.vue-flow__panel {
  background-color:#2d3748C0;
  border-radius: 8px;
  padding: 7px;
  margin-right: 10px;
  width: 350px;
}

.edge-selected {
  stroke: red !important
}

.info-line {
  width: 30%;
  height: 43px;
}
</style>
