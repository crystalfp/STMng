<script setup lang="ts">

import {ref} from "vue";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import type {Project, GraphNode} from "@/types";

const graph = ref<Record<string, GraphNode>>();
receiveInWindow((data) => {

    const project = JSON.parse(data) as Project;
    graph.value = project.graph;
});

const captureEscape = (event: KeyboardEvent): void => {
    if(event.key === "Escape") {
        closeWindow("/editor");
        event.preventDefault();
        document.removeEventListener("keydown", captureEscape);
    }
};
document.addEventListener("keydown", captureEscape);

</script>


<template>
<div class="graph-editor-portal">
  <div class="graph-editor-container">
  <code>{{ JSON.stringify(graph, undefined, 2) }}</code> <!-- TBD -->
  </div>
  <v-container class="graph-editor-button-strip">
    <v-btn @click="closeWindow('/editor')">
      Close
      <v-tooltip activator="parent" location="top">Close project viewer/editor</v-tooltip>
    </v-btn>
  </v-container>
</div>
</template>


<style scoped>

.graph-editor-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.graph-editor-container {
  overflow-y: auto;
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

</style>
