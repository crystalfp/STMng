<script setup lang="ts">

import {ref, shallowRef, watchEffect, defineAsyncComponent} from "vue";

const modules = ref([
    {id: "reader",  label: "Reader",    ui: "StructureReader"},
    {id: "draw",    label: "Draw",      ui: "DrawStructure"},
    {id: "viewer",  label: "Viewer",    ui: "Viewer3DCtrl"},
    {id: "another", label: "Another",   ui: ""},
]);
const selectedTab = ref(modules.value[0].id);
const loadedPanel = shallowRef<unknown>();

watchEffect(() => {

    for(const item of modules.value) {
        if(selectedTab.value === item.id) {
            loadedPanel.value = item.ui === "" ?
                                        undefined :
                                        defineAsyncComponent(() => import(`./Loadable${item.ui}.vue`));
        }
    }
});
</script>


<template>
<v-app theme="dark">
  <v-tabs v-model="selectedTab" center-active density="comfortable">
    <v-tab v-for="item of modules" :key="item.id" :value="item.id">{{ item.label }}</v-tab>
  </v-tabs>
  <v-divider :thickness="2" class="border-opacity-30" />
  <component :is="loadedPanel" />
</v-app>
</template>
