<script setup lang="ts">
/**
 * @component
 * Show symmetries in a secondary window.
 */

import {ref, onUnmounted, nextTick} from "vue";
import {closeWindow, receiveInWindow, receiveBroadcast, getPreferenceSync} from "@/services/RoutesClient";

const inSymmetry = ref("");
const outSymmetry = ref("");

interface SymmetriesData {
    inSymmetry: string;
    outSymmetry: string;
}

/** Receive the theme change */
const theme = ref(getPreferenceSync("Theme", "dark"));
receiveBroadcast((eventType: string, params: (string | boolean)[]) => {
    if(eventType === "theme-change") {
        theme.value = params[0] as string;
    }
});
receiveInWindow((data) => {

    void nextTick().then(() => {
        const decodedData = JSON.parse(data) as SymmetriesData;
        inSymmetry.value  = decodedData.inSymmetry;
        outSymmetry.value = decodedData.outSymmetry;
    });
});

const captureEscape = (event: KeyboardEvent): void => {
    if(event.key === "Escape") {
        closeWindow("/symmetries");
        event.preventDefault();
        document.removeEventListener("keydown", captureEscape);
    }
};
document.addEventListener("keydown", captureEscape);

onUnmounted(() => {
    document.removeEventListener("keydown", captureEscape);
});

</script>


<template>
<v-app :theme="theme">
<v-container class="symmetry-portal">
  <v-row class="symmetry-container">
    <v-col style="flex:1; overflow-y: auto">
      <v-label class="text-h5 justify-center mt-4 w-100">Input symmetry</v-label>
      <v-label :text="inSymmetry" class="mt-4 justify-center show-symmetry w-100" />
    </v-col>
    <v-divider thickness="8" vertical class="mt-4" />
    <v-col style="flex:1; overflow-y: auto">
      <v-label class="text-h5 justify-center mt-4 w-100">Output symmetry</v-label>
      <v-label :text="outSymmetry" class="mt-4 justify-center show-symmetry w-100" />
    </v-col>
  </v-row>
  <v-container class="symmetry-button-strip">
    <v-btn @click="closeWindow('/symmetries')">Close</v-btn>
  </v-container>
</v-container>
</v-app>
</template>


<style scoped>

.symmetry-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
  width: 100vw;
}

.symmetry-container {
  overflow-y: hidden;
  width: 100vw;
  flex: 2;
  display: flex;
  flex-direction: row;
  margin: 0;
}

.symmetry-button-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 10px;
  width: 100vw;
  max-width: 2000px;
}

.show-symmetry {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-family: monospace;
}

</style>
