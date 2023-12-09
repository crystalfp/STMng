<script setup lang="ts">

import {ref} from "vue";
import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

const changeSceneColor = (): void => {

    configStore.scene.background = configStore.scene.background === "skyblue" ? "maroon" : "skyblue";
};

const selectedTab = ref("reader");
</script>


<template>
<v-app theme="dark">
  <v-tabs v-model="selectedTab" center-active>
    <v-tab value="reader">Reader</v-tab>
    <v-tab value="viewer">Viewer3D</v-tab>
    <v-tab value="other">Other</v-tab>
    <v-tab value="another">Another</v-tab>
  </v-tabs>
  <v-divider :thickness="2" class="border-opacity-30" />
  <v-container v-if="selectedTab === 'viewer'">
    <v-btn variant="tonal" @click="changeSceneColor">Change scene color</v-btn>
    <v-checkbox v-model="configStore.scene.showAxis" label="Show axis" color="red" density="compact" />
    <v-checkbox v-model="configStore.scene.showGrid" label="Show grid" density="compact" />
    <v-label :text="selectedTab" />
  </v-container>
</v-app>
</template>
