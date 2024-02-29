<script setup lang="ts">
/**
 * @component
 * Generates a chart in a new windows with the structure of the loaded project
 */

import {ref, onMounted, onUnmounted} from "vue";
import {closeWindow, receiveInWindow,
        receiveBroadcast, getPreferenceSync} from "@/services/RoutesClient";
import type {Project, ProjectGraph} from "@/types";
import {sb} from "@/services/Switchboard";

/** Dimensions of the node on screen */
const NODE_WIDTH  = 150;
const NODE_HEIGHT =  50;
const NODE_GAP    =  10;

/** Set the foreground color */
const fg = ref("#FFF");
const setColors = (): void => {
    fg.value = theme.value === "dark" ? "#FFF" : "#000";
};

/** Receive the theme change */
const theme = ref(getPreferenceSync("Theme", "dark"));
setColors();
receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") {
        theme.value = params[0] as string;
        setColors();
    }
});

let graph: ProjectGraph;

/** Information about a node */
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

/** Information about an edge */
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
const createNodes = (projectGraph: ProjectGraph): NodeType[] => {

    // Select nodes that have connections
    const keysWithConnections = new Set<string>();
    for(const key in projectGraph) {
        for(const otherKey in projectGraph) {
            if(otherKey === key) continue;
            if(!projectGraph[otherKey].in) continue;
            const inputs = projectGraph[otherKey].in!.split(/, */);
            if(inputs.includes(key)) {
                keysWithConnections.add(key);
                keysWithConnections.add(otherKey);
            }
        }
    }

    // Add nodes that have graphical output
    for(const key in projectGraph) {
        if(sb.generatesGraphics(projectGraph[key].type)) keysWithConnections.add(key);
    }

    // Nodes to display
    const out: NodeType[] = [];

    // Start with nodes that have connections
    let x = NODE_GAP;
    let y = NODE_GAP;
    for(const key in projectGraph) {

        if(!keysWithConnections.has(key)) continue;

        const graphicsOut = sb.generatesGraphics(projectGraph[key].type) ? "out" : "";

        out.push({x, y, w: NODE_WIDTH, h: NODE_HEIGHT,
                  id: key, label: projectGraph[key].label, selected: false, graphics: graphicsOut});
        x += NODE_WIDTH + NODE_GAP;
        y += NODE_HEIGHT + NODE_GAP;
    }

    // Add the viewer at the end
    const viewerType = sb.getViewerType();
    for(const key in projectGraph) {
        if(projectGraph[key].type === viewerType) {
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
const createEdges = (projectGraph: ProjectGraph, nodesList: NodeType[]): EdgeType[] => {

    // Get the connections between nodes
    const connections = [];
    for(const key in projectGraph) {

        if(!projectGraph[key].in) continue;

        const inputs = projectGraph[key].in!.split(/, */);
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

        const project = JSON.parse(data) as Project;
        graph = project.graph;

        const nodesList = createNodes(graph);
        nodes.value = nodesList;

        edges.value = createEdges(graph, nodesList);
    });
});

/**
 * Close the window on Esc press
 *
 * @param event - The keyboard event to select ESC key
 */
const captureEscape = (event: KeyboardEvent): void => {
    if(event.key === "Escape") {
        closeWindow("/editor");
        event.preventDefault();
        document.removeEventListener("keydown", captureEscape);
    }
};
document.addEventListener("keydown", captureEscape);

onUnmounted(() => {
    document.removeEventListener("keydown", captureEscape);
});

const showInfo = ref(false);
const infoContent = ref<{label: string; value: string}[]>([]);

/**
 * Show the data pertaining to a node and toggle its visibility
 *
 * @param key - Key of the selected node
 */
const selectNode = (key: string): void => {

    if(showInfo.value) {
        showInfo.value = false;
        return;
    }
    showInfo.value = true;
    const node = graph[key];
    infoContent.value.length = 0;
    infoContent.value.push(
        {label: "Node id:",   value: key},
        {label: "Label:",     value: node.label},
        {label: "Node type:", value: node.type},
    );
};

</script>


<template>
<v-app :theme="theme">
<div class="graph-editor-portal">
  <div class="graph-editor-container">
    <svg width="2500" height="3000" x="0" y="0" viewBox="0 0 2500 3000"
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
    <v-table class="pa-3" density="comfortable">
      <tr v-for="i of infoContent" :key="i.label">
        <td class="w-25">{{ i.label }}</td>
        <td>{{ i.value }}</td>
      </tr>
    </v-table>
  </v-container>
  <v-container class="graph-editor-button-strip">
    <v-btn v-if="showInfo" class="mr-2" @click="showInfo=false">Close info</v-btn>
    <v-btn @click="closeWindow('/editor')">Close</v-btn>
  </v-container>
</div>
</v-app>
</template>


<style scoped lang="scss">

.graph-editor-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.graph-editor-container {
  overflow-y: scroll;
  width: 100vw;
  flex: 2;
  padding: 10px;
}

.graph-editor-button-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  max-width: 2000px;
}

// > Colors
$node-selected-color: #FF0;

// > Node
.border {
  stroke: v-bind(fg);
  stroke-width: 2;
  fill: transparent;
}

.node {
  cursor: pointer;
}

.selected {
  fill: darken($node-selected-color, 25%) {
    opacity: 0.8;
  }
  stroke: $node-selected-color {
    width: 2;
    opacity: 1;
  }
}

// > Text field
.label {
  fill: v-bind(fg);
  font-size: 1.1rem;
  user-select: none;
}

</style>
