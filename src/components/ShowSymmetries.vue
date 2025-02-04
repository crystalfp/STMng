<script setup lang="ts">
/**
 * @component
 * Show symmetries in a secondary window.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, nextTick} from "vue";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {closeWithEscape} from "@/services/CaptureEscape";
import {theme} from "@/services/ReceiveTheme";

const inSymmetry = ref("");
const outSymmetry = ref("");

interface SymmetriesData {
    inSymmetry: string;
    outSymmetry: string;
}

receiveInWindow((data) => {

    void nextTick().then(() => {
        const decodedData = JSON.parse(data) as SymmetriesData;
        inSymmetry.value  = decodedData.inSymmetry;
        outSymmetry.value = decodedData.outSymmetry;
    });
});

/** Close the window on Esc press */
closeWithEscape("/symmetries");

</script>


<template>
<v-app :theme="theme">
<v-container class="symmetry-portal">
  <v-row class="symmetry-container">
    <v-col class="left-col">
      <v-label class="text-h5 justify-center mt-n2 w-100">Input symmetry</v-label>
      <v-label :text="inSymmetry" class="mt-4 justify-center show-symmetry w-100" />
    </v-col>
    <v-col class="right-col">
      <v-label class="text-h5 justify-center mt-n2 w-100">Output symmetry</v-label>
      <v-label :text="outSymmetry" class="mt-4 justify-center show-symmetry w-100" />
    </v-col>
  </v-row>
  <v-container class="button-strip">
    <v-btn v-focus @click="closeWindow('/symmetries')">Close</v-btn>
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
}

.symmetry-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
  display: flex;
  flex-direction: row;
  margin: 0;
  height: 100%;
  padding-top: 15px;
  max-width: 3000px !important;
}

.show-symmetry {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-family: monospace;
}

.left-col {
  flex: 1;
  border-right: 3px solid #B8B8B8;
}

.right-col {
  flex: 1;
}
</style>
