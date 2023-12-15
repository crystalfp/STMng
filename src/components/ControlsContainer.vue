<script setup lang="ts">

import {ref, shallowRef, watchEffect, defineAsyncComponent} from "vue";
import {receiveBroadcast, receiveProject, getPreferenceSync} from "@/services/RoutesClient";
import type {Project, ProjectElement} from "@/types";

const project = ref<Project | undefined>();
const modules = ref<ProjectElement[]>([]);
const selectedTabId = ref("");

receiveProject((rawProject: string) => {

    project.value = JSON.parse(rawProject) as Project;
    modules.value = project.value.elements;
    selectedTabId.value = modules.value[0].id;
});

const loadedPanel = shallowRef<unknown>();
const inFrom = ref("");

watchEffect(() => {

    for(const item of modules.value) {
        if(selectedTabId.value === item.id) {
            loadedPanel.value = item.ui === "" ?
                                        undefined :
                                        defineAsyncComponent(() => import(`../ui/${item.ui}.vue`));
            inFrom.value = item.in;
            break;
        }
    }
});

const theme = ref(getPreferenceSync("Theme", "dark"));
receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") theme.value = params[0] as string;
});
</script>


<template>
<v-app :theme="theme">
  <v-tabs v-model="selectedTabId" center-active density="comfortable">
    <v-tab v-for="item of modules" :key="item.id" :value="item.id">{{ item.label }}</v-tab>
  </v-tabs>
  <component :is="loadedPanel" :in="inFrom" />
</v-app>
</template>
