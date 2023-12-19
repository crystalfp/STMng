<script setup lang="ts">
/**
 * @component
 * Manage the load of the elements' user interfaces
 */

import {ref, shallowRef, watchEffect, defineAsyncComponent} from "vue";
import {receiveBroadcast, receiveProject, getPreferenceSync,
        sendProject} from "@/services/RoutesClient";
import type {Project, ProjectElement} from "@/types";
import {gm} from "@/services/GraphManager";

const project = ref<Project | undefined>();
const graph = ref<ProjectElement[]>([]);
const selectedTabId = ref("");

/** Receive the project loaded */
receiveProject((rawProject: string) => {

    project.value = JSON.parse(rawProject) as Project;
    graph.value = project.value.graph;
    selectedTabId.value = graph.value[0].id;
    gm.updateGraph(graph.value);
});

sendProject(() => {
    return JSON.stringify(project.value);
});

const loadedPanel = shallowRef<unknown>();
const inFrom = ref("");

watchEffect(() => {

    for(const item of graph.value) {
        if(selectedTabId.value === item.id) {
            loadedPanel.value = item.ui === "" ?
                                        undefined :
                                        defineAsyncComponent(() => import(`../ui/${item.ui}.vue`));
            inFrom.value = item.in;
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
  <component :is="loadedPanel" :in="inFrom" />
</v-app>
</template>
