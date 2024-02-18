<script setup lang="ts">

import {ref, onMounted} from "vue";
import {closeWindow, receiveInWindow,
        receiveBroadcast, getPreferenceSync} from "@/services/RoutesClient";
import {showErrorNotification} from "@/services/ErrorNotification";
import type {Project, GraphNode} from "@/types";

const NODE_WIDTH = 150;
const NODE_HEIGHT = 50;

// Set the line color
const line = ref("#FFF");
const setColors = (): void => {
    line.value = theme.value === "dark" ? "#FFF" : "#000";
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

let graph: Record<string, GraphNode>;

// Reference to the view
const svg = ref<SVGElement | null>(null);

/** Information about a node */
interface NodeType {
    x: number;
    y: number;
    w: number;
    h: number;
    id: string;
    label: string;
    selected: boolean;
}

/** Information about an edge */
interface EdgeType {
    idx: number;
    points: string;
}
const nodes = ref<NodeType[]>([]);
const edges = ref<EdgeType[]>([]);

onMounted(() => {

    if(!svg.value) {
        showErrorNotification("Cannot create graph editor/viewer.");
        return;
    }

    // When the loaded project changes
    receiveInWindow((data) => {

        const project = JSON.parse(data) as Project;
        graph = project.graph;

        // Select nodes that have connections
        const keysWithConnections = new Set<string>();
        for(const key in graph) {
            for(const otherKey in graph) {
                if(otherKey === key) continue;
                if(!graph[otherKey].in) continue;
                const inputs = graph[otherKey].in!.split(/, */);
                if(inputs.includes(key)) {
                    keysWithConnections.add(key);
                    keysWithConnections.add(otherKey);
                }
            }
        }

        // Empty the node lists
        nodes.value.length = 0;

        // Start with nodes that have connections
        let x = 0;
        let y = 0;
        for(const key in graph) {

            if(!keysWithConnections.has(key)) continue;

            const node = graph[key];
            nodes.value.push({x, y,
                              w: NODE_WIDTH, h: NODE_HEIGHT,
                              id: key, label: node.label, selected: false});
            x += NODE_WIDTH + 10;
            y += NODE_HEIGHT + 10;
        }

        // Then nodes that have no (explicit) connections
        x = 0;
        y += NODE_HEIGHT + 10;
        for(const key in graph) {

            if(keysWithConnections.has(key)) continue;

            const node = graph[key];
            nodes.value.push({x, y,
                              w: NODE_WIDTH, h: NODE_HEIGHT,
                              id: key, label: node.label, selected: false});
            x += NODE_WIDTH + 10;
        }

        // Get the connections between nodes
        const connections = [];
        for(const key in graph) {
            if(!graph[key].in) continue;
            const inputs = graph[key].in!.split(/, */);
            for(const input of inputs) {
                const from = input;
                const to = key;

                const connection = {

                    xFrom: 0,
                    yFrom: 0,
                    wFrom: 0,
                    hFrom: 0,
                    xTo: 0,
                    yTo: 0,
                    wTo: 0,
                    hTo: 0,
                };
                for(const node of nodes.value) {
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

        // Compute edges
        let idx = 0;
        for(const connection of connections) {

            let xStart;
            let yStart;
            let xEnd;
            let yEnd;

            if(connection.xFrom < connection.xTo) {
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
            edges.value.push({idx, points});
            ++idx;
        }
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

const showInfo = ref(false);
const infoContent = ref<{label: string; value: string}[]>([]);
const selectNode = (key: string): void => {

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
    <!-- eslint-disable @alasdair/max-len/max-len -->
    <svg ref="svg" width="2500" height="3000" x="0" y="0" viewBox="0 0 2500 3000"
    	   xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Arrows -->
        <marker id="arrow" markerWidth="6" markerHeight="4" refX="4" refY="2"
                orient="auto" markerUnits="strokeWidth">
          <polygon points="0,0 0,4 6,2" :fill="line" />
        </marker>
      </defs>
      <svg v-for="n of nodes" :key="n.id" :x="n.x" :y="n.y"
           :width="n.w" :height="n.h" class="node" @click="selectNode(n.id)">
        <rect class="border" :class="{selected: n.selected}" x="1" y="1"
          :width="n.w-2" :height="n.h-2" rx="10" ry="10" />
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="label">{{ n.label }}</text>
      </svg>
      <polyline v-for="e of edges" :key="e.idx" :points="e.points" :stroke="line"
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
// $node-hover-color: #0F0;
$node-label-font: Verdana,Arial,Helvetica,Geneva,'DejaVu Sans',sans-serif;

// > Node
.border {
  stroke: v-bind(line);
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
  fill: v-bind(line);
  font: {
    size: 1rem;
    family: $node-label-font;
  }
}

</style>
