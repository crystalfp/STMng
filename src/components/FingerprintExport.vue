<script setup lang="ts">
/**
 * @component
 * Export the fingerprinting results as structures
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-08-22
 */
import {ref} from "vue";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, receiveInWindow, askNode, /* sendToNode */} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import SelectFile from "@/widgets/SelectFile.vue";

const kind = ref("");
const showExport = ref(false);
const hasEnergies = ref(false);
const saveEnergyPerAtom = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const filterPOSCAR = JSON.stringify([{name: "POSCAR", extensions: ["poscar"]},
                                     {name: "All",    extensions: ["*"]}]);

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/fp-export");

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {
    hasEnergies.value = (JSON.parse(dataFromMain) as {hasEnergy: boolean}).hasEnergy;
});

/**
 * Save selected structures to the chosen file name
 *
 * @param filename - Selected filename
 */
const selectedExportFile = (filename: string): void => {

    if(filename && kind.value) {

        askNode("SYSTEM", "export-points", {
            filename,
            kind: kind.value,
            saveEnergyPerAtom: saveEnergyPerAtom.value
        })
        .then((status: CtrlParams) => {

            if(status.error) throw Error(status.error as string);
            const energy = status.energyPath as string ? ` and ${status.energyPath as string}` : "";
            successMessage.value = `Saved ${status.structurePath as string}${energy}`;
        })
        .catch((error: Error) => {
            errorMessage.value = `Error from exporting structures: ${error.message}`;
        });
    }
    showExport.value = false;
};

/**
 * Toggle export operation
 *
 * @param exportKind - Function to be activated
 */
const toggleExport = (exportKind: string): void => {

    kind.value = exportKind;
    showExport.value = !showExport.value;
    errorMessage.value = "";
    successMessage.value = "";
};

</script>


<template>
<v-app :theme class="d-flex">
  <v-container class="flex-1-1">
  <v-btn block class="mb-2"
         @click="toggleExport('all')">
    Export results
  </v-btn>
  <v-btn :disabled="!hasEnergies" block class="mt-4 mb-4"
         @click="toggleExport('min')">
    Min energy per group
  </v-btn>
  <v-btn :disabled="!hasEnergies" block class="mt-4 mb-4"
         @click="toggleExport('hull')">
    Gen. convex hull
  </v-btn>

  <select-file v-if="showExport" class="mt-4 ml-n1" title="Select output file"
               :filter="filterPOSCAR" kind="save" @selected="selectedExportFile" />
  <v-switch v-if="showExport && hasEnergies" v-model="saveEnergyPerAtom"
               class="ml-2 mt-2" label="Save energy per atom"/>
  <v-alert v-if="errorMessage !== ''" title="Error" class="mt-4 ml-1 cursor-pointer"
      :text="errorMessage" type="error" density="compact"
      color="red" @click="errorMessage=''" />
  <v-alert v-if="successMessage !== ''" title="Success!" :text="successMessage"
      type="success" density="compact" class="mt-4 ml-1 cursor-pointer"
      @click="successMessage=''"/>
  </v-container>
  <v-container class="d-flex flex-0-1 justify-end">
    <v-btn v-focus @click="closeWindow('/fp-export')">Close</v-btn>
  </v-container>
</v-app>
</template>
