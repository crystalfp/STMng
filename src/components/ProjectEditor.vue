<script setup lang="ts">
/**
 * @component
 * Generates a chart in a new windows with the structure of the loaded project.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, onMounted, computed, shallowRef, watch} from "vue";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {closeWithEscape} from "@/services/CaptureEscape";
import {theme} from "@/services/ReceiveTheme";
import type {ClientProjectInfo, ClientProjectInfoItem, OneNodeInfo, ProjectInfo} from "@/types";

/** Dimensions of the node on screen */
const NODE_WIDTH  = 160;
const NODE_HEIGHT =  44;
const NODE_GAP    =  10;

/** Set the foreground color */
const fg = computed(() => (theme.value === "dark" ? "#FFF" : "#000"));

let graph: ClientProjectInfo;

const showConfirm = ref(false);
const showEdit = ref(false);
const showAdd = ref(false);
const selectedId = ref("");
const selectedLabel = ref("");
const selectedInput = ref("");
const disableActions = ref(false);
const allNodes = ref<{label: string; type: string}[]>([]);

/**
 * Information about a node
 * @notExported
 */
interface NodeType {
    x: number;
    y: number;
    w: number;
    h: number;
    id: string;
    label: string;
    selected: boolean;
    graphics: string;  // Contains "in" for the viewer node, "out" for nodes that generate graphics objects
}

/**
 * Information about an edge
 * @notExported
 */
interface EdgeType {
    idx: number;
    points: string;
    dotted: string;
}

/**
 * Create nodes for the chart
 *
 * @param projectGraph - The project graph
 * @returns The array of nodes to display
 */
const createNodes = (projectGraph: ClientProjectInfo): NodeType[] => {

    // Select nodes that have connections
    const keysWithConnections = new Set<string>();
    for(const key in projectGraph) {
        for(const otherKey in projectGraph) {
            if(otherKey === key) continue;
            if(!projectGraph[otherKey].input) continue;
            if(projectGraph[otherKey].input.includes(key)) {
                keysWithConnections.add(key);
                keysWithConnections.add(otherKey);
            }
        }
    }

    // Add nodes that have graphical output
    for(const key in projectGraph) {
        if(projectGraph[key].graphic === "out") keysWithConnections.add(key);
    }

    // Nodes to display
    const out: NodeType[] = [];

    // Start with nodes that have connections
    let x = NODE_GAP;
    let y = NODE_GAP;
    for(const key in projectGraph) {

        if(!keysWithConnections.has(key)) continue;

        const graphicsOut = projectGraph[key].graphic === "out" ? "out" : "";

        out.push({x, y, w: NODE_WIDTH, h: NODE_HEIGHT,
                  id: key, label: projectGraph[key].label, selected: false, graphics: graphicsOut});
        x += NODE_WIDTH + NODE_GAP;
        y += NODE_HEIGHT + NODE_GAP;
    }

    // Add the viewer at the end
    for(const key in projectGraph) {
        if(projectGraph[key].graphic === "in") {
            out.push({x, y, w: NODE_WIDTH, h: NODE_HEIGHT,
                      id: key, label: projectGraph[key].label, selected: false, graphics: "in"});
            keysWithConnections.add(key);
            x += NODE_WIDTH + NODE_GAP;
            y += NODE_HEIGHT + NODE_GAP;
            break;
        }
    }

    // Then put nodes that have no connections
    for(const key in projectGraph) {

        if(keysWithConnections.has(key)) continue;

        out.push({x, y, w: NODE_WIDTH, h: NODE_HEIGHT,
                  id: key, label: projectGraph[key].label, selected: false, graphics: ""});
        x += NODE_WIDTH + NODE_GAP;
        y += NODE_HEIGHT + NODE_GAP;
    }

    return out;
};

/**
 * Add edges to the chart
 *
 * @param projectGraph - The project graph part
 * @param nodesList - The already computed nodes
 * @returns The list of edges for the chart
 */
const createEdges = (projectGraph: ClientProjectInfo, nodesList: NodeType[]): EdgeType[] => {

    // Get the connections between nodes
    const connections = [];
    for(const key in projectGraph) {

        if(!projectGraph[key].input) continue;

        const inputs = projectGraph[key].input;
        for(const input of inputs) {
            const from = input;
            const to = key;

            const connection = {

                xFrom:   0,
                yFrom:   0,
                wFrom:   0,
                hFrom:   0,
                xTo:     0,
                yTo:     0,
                wTo:     0,
                hTo:     0,
                special: false,
            };
            for(const node of nodesList) {
                if(node.id === from) {
                    connection.xFrom = node.x;
                    connection.yFrom = node.y;
                    connection.wFrom = node.w;
                    connection.hFrom = node.h;
                }
                else if(node.id === to) {
                    connection.xTo = node.x;
                    connection.yTo = node.y;
                    connection.wTo = node.w;
                    connection.hTo = node.h;
                }
            }
            connections.push(connection);
        }
    }

    // Get the viewer node
    let viewerNode;
    for(const node of nodesList) {
        if(node.graphics === "in") {
            viewerNode = node;
            break;
        }
    }

    // Get the special connections
    if(viewerNode) {
        for(const node of nodesList) {
            if(node.graphics === "out") {
                const connection = {

                    xFrom:   node.x,
                    yFrom:   node.y,
                    wFrom:   node.w,
                    hFrom:   node.h,
                    xTo:     viewerNode.x,
                    yTo:     viewerNode.y,
                    wTo:     viewerNode.w,
                    hTo:     viewerNode.h,
                    special: true,
                };
                connections.push(connection);
            }
        }
    }

    // Compute edges
    let idx = 0;
    const out: EdgeType[] = [];
    for(const connection of connections) {

        let xStart;
        let yStart;
        let xEnd;
        let yEnd;

        if(connection.special) {
            // Connection under the diagonal, but reversed
            xStart = connection.xFrom + connection.wFrom / 2;
            yStart = connection.yFrom + connection.hFrom;
            xEnd   = connection.xTo - 2;
            yEnd   = connection.yTo + connection.hTo / 2;

            const specialPoints = `${xStart},${yStart} ${xStart},${yEnd} ${xEnd},${yEnd}`;
            out.push({idx, points: specialPoints, dotted: "3 2"});
            ++idx;
            continue;
        }
        else if(connection.xFrom < connection.xTo) {
            // Connection above the diagonal
            xStart = connection.xFrom + connection.wFrom;
            yStart = connection.yFrom + connection.hFrom / 2;
            xEnd   = connection.xTo + connection.wTo / 2;
            yEnd   = connection.yTo - 2;
        }
        else {
            // Connection under the diagonal
            xStart = connection.xTo;
            yStart = connection.yTo + connection.hTo / 2;
            xEnd   = connection.xFrom + connection.wFrom / 2;
            yEnd   = connection.yFrom + connection.hFrom + 2;
        }
        const points = `${xStart},${yStart} ${xEnd},${yStart} ${xEnd},${yEnd}`;
        out.push({idx, points, dotted: ""});
        ++idx;
    }

    return out;
};

/** Data that goes to the chart */
const nodes = ref<NodeType[]>([]);
const edges = ref<EdgeType[]>([]);

onMounted(() => {

    // When the loaded project changes
    receiveInWindow((data) => {

        const info = JSON.parse(data) as ProjectInfo;
        graph = info.graph;

        const nodesList = createNodes(graph);
        nodes.value = nodesList;

        edges.value = createEdges(graph, nodesList);

        // Get the list of possible nodes
        allNodes.value.length = 0;
        for(const entry of info.allNodes) {

            if(entry.graphic === "in") continue;
            const entryType = entry.type;
            const label = entryType[0].toUpperCase() + entryType.slice(1).replaceAll("-", " ");
            allNodes.value.push({label, type: entry.type});
        }
        nodeToAdd.value = info.allNodes[0].type;

        allInfo.value = info.allNodes;
    });
});

/** Close the window on Esc press */
closeWithEscape("/editor");

const showInfo = ref(false);
const infoContent = shallowRef<{label: string; value: string}[]>([]);

/**
 * Show the data pertaining to the selected node and toggle its visibility
 *
 * @param key - Key of the selected node
 */
const selectNode = (key: string): void => {

    // Change node selected indicator
    const nnodes = nodes.value.length;
    for(let i=0; i < nnodes; ++i) {
        if(nodes.value[i].selected) nodes.value[i].selected = false;
        if(nodes.value[i].id === key) nodes.value[i].selected = true;
    }

    // Disable deleting viewer
    disableActions.value = graph[key].type === "viewer-3d";

    // The id of the selected node
    selectedId.value = key;
    selectedLabel.value = graph[key].label;
    selectedInput.value = graph[key].input[0];

    // Fill and show the info section
    showInfo.value = true;
    const node = graph[key];
    infoContent.value.length = 0;
    infoContent.value.push(
        {label: "Node id:",   value: key},
        {label: "Label:",     value: node.label},
        {label: "Node type:", value: node.type},
        {label: "Input:",     value: node.input.join(", ")},
        {label: "Graphics:",  value: node.graphic},
    );
};

/**
 * Close the info section and deselect the selected node
 */
const closeInfo = (): void => {

    // Close the info section
    showInfo.value = false;

    // Remove the selection indicator
    const nnodes = nodes.value.length;
    for(let i=0; i < nnodes; ++i) {
        if(nodes.value[i].selected) {
            nodes.value[i].selected = false;
            break;
        }
    }
};

/**
 * Delete the selected node
 */
const confirmDeletion = (): void => {

    showConfirm.value = false;

    // TBD Delete the current node
    console.log("Deleting node:", selectedId.value);
};

/** List of nodes from the input could be taken */
const inputFromOther = computed(() => {

    // If has no input
    const editedNodeType = graph[selectedId.value].type;
    if(allInfo.value.some((item) => item.type === editedNodeType && !item.in)) return [];

    // All nodes that has an input
    const nodesWithOut = allInfo.value.filter((item) => item.out);

    const out = [];
    for(const key in graph) {

        for(const node of nodesWithOut) {
            if(node.type === graph[key].type && key !== selectedId.value) {
                out.push({label: graph[key].label, id: key});
            }
        }
    }
    selectedInput.value = graph[selectedId.value].input[0];
    return out;
});

/**
 * Edit the selected node
 */
const saveEditedNode = (): void => {

    showEdit.value = false;

    const node = graph[selectedId.value];

    node.label = selectedLabel.value;
    node.input = [selectedInput.value];

    // TBD Use the modified node
    console.log("Edit node:", node);
};

const nodeToAdd = ref("");
const allInfo = ref<OneNodeInfo[]>([]);

/** All nodes from which the added node could take an input */
const inputFrom = computed(() => {

    if(allInfo.value.some((item) => item.type === nodeToAdd.value && !item.in)) return [];

    const nodesWithOut = allInfo.value.filter((item) => item.out);

    const out = [];
    for(const key in graph) {

        for(const node of nodesWithOut) {
            if(node.type === graph[key].type) {
                out.push({label: graph[key].label, id: key});
            }
        }
    }
    inputId.value = out[0].id;
    return out;
});
const inputId = ref("");
const nodeLabel = ref("");

watch(nodeToAdd, () => {

    nodeLabel.value = nodeToAdd.value[0].toUpperCase() + nodeToAdd.value.slice(1).replaceAll("-", " ");
});

/**
 * Add a new node to the project
 */
const addNode = (): void => {

    showAdd.value = false;

    const node = allInfo.value.find((item) => item.type === nodeToAdd.value);
    if(!node) return;

    // Find the next free id
    let sequence = 0;
    let id = node.idPrefix;
    while(graph[id]) {
        ++sequence;
        id = `${node.idPrefix}${sequence}`;
    }

    const nodeInfo: ClientProjectInfoItem = {
        id,
        label: nodeLabel.value,
        type: nodeToAdd.value,
        input: [inputId.value],
        ui: node.ui,
        graphic: node.graphic
    };

    // TBD Add the node to the project
    console.log("Add node:", nodeInfo);
};

</script>


<template>
<v-app :theme="theme">
<div class="graph-editor-portal">
  <div class="graph-editor-container">
    <svg width="3000" height="3000" x="0" y="0" viewBox="0 0 3000 3000"
    	 xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="4" refX="4" refY="2"
                orient="auto" markerUnits="strokeWidth">
          <polygon points="0,0 0,4 6,2" :fill="fg" />
        </marker>
      </defs>
      <svg v-for="n of nodes" :key="n.id" :x="n.x" :y="n.y"
           :width="n.w" :height="n.h" class="node" @click="selectNode(n.id)">
        <rect class="border" :class="{selected: n.selected}" x="1" y="1"
          :width="n.w-2" :height="n.h-2" rx="10" ry="10" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              class="label">{{ n.label }}</text>
      </svg>
      <polyline v-for="e of edges" :key="e.idx" :points="e.points" :stroke="fg"
                :stroke-dasharray="e.dotted"
			    style="stroke-width:2;stroke-linecap:butt;fill:none;stroke-opacity:0.7"
			    marker-end="url(#arrow)" pointer-events="none" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
  <v-container v-if="showInfo" class="mt-2">
    <v-row>
      <v-col cols="10">
        <v-table class="pa-3" density="comfortable">
          <tr v-for="i of infoContent" :key="i.label">
            <td class="w-25">{{ i.label }}</td>
            <td>{{ i.value }}</td>
          </tr>
        </v-table>
      </v-col>
      <!-- TBD remove v-if after workshop -->
      <v-col cols="2" v-if="true" class="my-auto">
        <v-row><v-btn class="w-50 mb-2" @click="showAdd=true">Add</v-btn></v-row>
        <v-row><v-btn class="w-50 mb-2" @click="showEdit=true"
                      :disabled="disableActions">Edit</v-btn></v-row>
        <v-row><v-btn class="w-50" @click="showConfirm=true"
                      :disabled="disableActions">Delete</v-btn></v-row>
      </v-col>
    </v-row>
  </v-container>
  <v-container class="button-strip">
    <v-btn v-if="showInfo" variant="tonal" class="mr-2" @click="closeInfo">Dismiss info</v-btn>
    <v-btn v-focus variant="tonal" @click="closeWindow('/editor')">Close</v-btn>
  </v-container>
</div>

<v-dialog v-model="showConfirm">
  <v-card title="Confirm deletion" text="Do you want to remove the currently selected node?"
          class="mx-auto" elevation="16" max-width="500">
    <v-card-actions>
        <v-btn v-focus @click="showConfirm=false">Dismiss</v-btn>
        <v-btn @click="confirmDeletion">Yes</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

<v-dialog v-model="showEdit">
  <v-card title="Edit selected node"
          class="mx-auto" elevation="16" width="400">
    <v-card-text>
      <v-text-field v-model="selectedLabel"
                label="Node label" class="mt-2"
                variant="solo-filled" hide-details="auto"
                clearable spellcheck="false" />
		  <v-select v-if="inputFromOther.length > 0" v-model="selectedInput" :items="inputFromOther"
                item-title="label" item-value="id"
		            variant="solo-filled" density="compact" hide-details class="mt-2" />
    </v-card-text>
    <v-card-actions>
      <v-btn v-focus @click="showEdit=false">Dismiss</v-btn>
      <v-btn @click="saveEditedNode">Save</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

<v-dialog v-model="showAdd">
  <v-card title="Add node to project" class="mx-auto" elevation="16" width="400">
    <v-card-text>
		  <v-select v-model="nodeToAdd" :items="allNodes" item-title="label" item-value="type"
		            variant="solo-filled" density="compact" hide-details />
      <v-text-field v-model="nodeLabel"
                label="New node label" class="mt-2"
                variant="solo-filled" hide-details="auto"
                clearable spellcheck="false" />
		  <v-select v-if="inputFrom.length > 0" v-model="inputId" :items="inputFrom"
                item-title="label" item-value="id"
		            variant="solo-filled" density="compact" hide-details class="mt-2" />
    </v-card-text>
    <v-card-actions>
      <v-btn v-focus @click="showAdd=false">Dismiss</v-btn>
      <v-btn :disabled="!nodeLabel" @click="addNode">Add</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

</v-app>
</template>


<style scoped>

.graph-editor-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.graph-editor-container {
  overflow-y: scroll;
  width: 100vw;
  flex: 2;
  padding: 10px;
}

/* > Node */
.border {
  stroke: v-bind(fg);
  stroke-width: 2;
  fill: transparent;
}

.node {
  cursor: pointer;
}

.selected {
  --node-selected-color: #FFFF00FF;
  --node-selected-fill: #BFBF00CD; /* Is SCSS color.adjust($node-selected-color, $lightness: -25%) */

  fill: var(--node-selected-fill);
  stroke: var(--node-selected-color);
  stroke-width: 2;
}

/* > Text field */
.label {
  fill: v-bind(fg);
  font-size: 1.1rem;
  user-select: none;
}

</style>
