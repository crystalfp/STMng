<script setup lang="ts">
/**
 * @component
 * Manage the load of the elements' user interfaces
 */

import {ref, shallowRef, watchEffect, defineAsyncComponent} from "vue";
import {receiveBroadcast, getPreferenceSync} from "@/services/RoutesClient";
import {sb, type NodeUI} from "@/services/Switchboard";

const graph = ref<NodeUI[]>([]);
const selectedTabId = ref("");
const loadedPanel = shallowRef<unknown>();
const inFrom = ref("");
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

watchEffect(() => {

    for(const item of graph.value) {
        if(selectedTabId.value === item.id) {
            loadedPanel.value = item.ui === "" ?
                                        undefined :
                                        defineAsyncComponent(() => import(`../ui/${item.ui}.vue`));
            inFrom.value = item.in;
            moduleId.value = item.id;
            break;
        }
    }
});

/** Receive the theme change */
const theme = ref(getPreferenceSync("Theme", "dark"));
receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") theme.value = params[0] as string;
});

</script>


<template>
<v-app :theme="theme">
  <v-tabs v-model="selectedTabId" center-active density="comfortable">
    <v-tab v-for="item of graph" :key="item.id" :value="item.id">{{ item.label }}</v-tab>
  </v-tabs>
  <component :is="loadedPanel" :id="moduleId" :in="inFrom" />
</v-app>
</template>
