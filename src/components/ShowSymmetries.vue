<script setup lang="ts">
/**
 * @component
 * Show symmetries in a secondary window.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */

import {ref, nextTick, computed} from "vue";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";

const inSymmetry = ref("");
const outSymmetry = ref("");
const pointGroup = ref("");
const intlSymbol = ref("");
const displayMode = ref("international");
const sgNumberIn = ref(0);
const sgNumberOut = ref(0);

/**
 * Data for the show symmetry window
 * @notExported
 */
interface SymmetriesData {
    /** Input symmetry group */
    inSymmetry?: string;
    /** Computed output symmetry group */
    outSymmetry?: string;
    /** Computed point group */
    pointGroup?: string;
    /** International symmetry symbol */
    intlSymbol?: string;
    /** Symmetry display mode */
		displayMode: string;
    /** Input space group number */
    sgNumberIn?: number;
    /** Computed space group number */
    sgNumberOut?: number;

}

receiveInWindow((data) => {

    void nextTick().then(() => {
        const decodedData = JSON.parse(data) as SymmetriesData;
        if(decodedData.inSymmetry !== undefined) {
            inSymmetry.value  = decodedData.inSymmetry;
            outSymmetry.value = decodedData.outSymmetry!;
            pointGroup.value  = decodedData.pointGroup!;
            intlSymbol.value  = decodedData.intlSymbol!;
            sgNumberIn.value  = decodedData.sgNumberIn!;
            sgNumberOut.value = decodedData.sgNumberOut!;
        }
        displayMode.value  = decodedData.displayMode;
    });
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/symmetries");

const inputValue = computed(() => {
    if(displayMode.value === "table" && sgNumberIn.value !== 0) return sgNumberIn.value.toString();
    return inSymmetry.value;
});
const finalValue = computed(() => {
    if(displayMode.value === "table" && sgNumberOut.value !== 0) return sgNumberOut.value.toString();
    if(displayMode.value === "symmop") return outSymmetry.value;
    return intlSymbol.value;
});
</script>


<template>
<v-app :theme>
<v-container class="symmetry-portal">
  <v-row class="symmetry-container">
    <v-col class="left-col">
      <v-label class="text-h5 justify-center mt-n2 w-100">Input symmetry</v-label>
      <v-label :text="inputValue" class="mt-4 justify-center show-symmetry w-100" />
    </v-col>
    <v-col class="right-col">
      <v-label v-if="pointGroup!==''" class="text-h5 justify-center mt-n2 w-100">Point group</v-label>
      <v-label v-if="pointGroup!==''" :text="pointGroup" class="justify-center w-100 my-2 show-pg" />
      <v-label class="text-h5 justify-center mt-n2 w-100">Output symmetry</v-label>
      <v-label :text="finalValue" class="mt-4 justify-center show-symmetry w-100" />
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
  color: light-dark(#7ca911, #baf434) !important;
  opacity: 1 !important;
}

.left-col {
  flex: 1;
  border-right: 3px solid #B8B8B8;
}

.right-col {
  flex: 1;
}

.show-pg {
  color: light-dark(#7ca911, #baf434) !important;
  opacity: 1 !important;
  font-family: monospace;
}

</style>
