<script setup lang="ts">
/**
 * @component
 * Manage the load of the elements' user interfaces
 */

import {ref, shallowRef, watchEffect, defineAsyncComponent} from "vue";
import {sendCurrentNode} from "@/services/RoutesClient";
import {sb} from "@/services/Switchboard";
import type {NodeUI} from "@/types";
import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

const graph = ref<NodeUI[]>([]);
const selectedTabId = ref("");
const loadedPanel = shallowRef<unknown>();
const moduleId = ref("");

/** When the project is loaded */
sb.subscribeToUiNodes((nodes: NodeUI[], currentId: string) => {

    graph.value.length = 0;
    selectedTabId.value = "";

    if(nodes.length === 0) return;

    let found = false;
    for(const node of nodes) {
        graph.value.push(node);
        if(node.id === currentId) found = true;
    }
    selectedTabId.value = found ? currentId : graph.value[0].id;
});

// Return to the main process the type of the current node open in the UI
sendCurrentNode(() => sb.getNodeType(moduleId.value));

watchEffect(() => {

    for(const item of graph.value) {
        if(selectedTabId.value === item.id) {
            loadedPanel.value = item.ui === "" ?
                                        undefined :
                                        defineAsyncComponent(() => import(`../ui/${item.ui}.vue`));
            moduleId.value = item.id;
            break;
        }
    }
});

</script>


<template>
  <v-container class="pa-0">
    <v-select v-model="selectedTabId" :items="graph" item-title="label" item-value="id"
              variant="solo-filled" density="compact" hide-details rounded="0" />
  </v-container>
  <!-- <v-tabs v-model="selectedTabId" center-active density="comfortable">
    <v-tab v-for="item of graph" :key="item.id" :value="item.id" size="small">{{ item.label }}</v-tab>
  </v-tabs> -->
  <component :is="loadedPanel" :id="moduleId" />
  <v-btn density="comfortable" variant="tonal" rounded="0" @click="configStore.control.reset = true">
    Reset camera
  </v-btn>
</template>

<style>
.v-select__selection-text {
  /* padding-left: 5px; */
  font-size: 140%;
}
</style>
