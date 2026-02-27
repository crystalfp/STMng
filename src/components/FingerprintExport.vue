<script setup lang="ts">
/**
 * @component
 * Export the fingerprinting results as structures
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-08-22
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {ref} from "vue";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData, askNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import SelectFile from "@/widgets/SelectFile.vue";
import BlockButton from "@/widgets/BlockButton.vue";

const kind = ref("");
const showExport = ref(false);
const hasEnergies = ref(false);
const saveEnergyPerAtom = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const windowPath = "/fp-export";

const filterPOSCAR = '[{"name":"POSCAR","extensions":["poscar"]},{"name":"All","extensions":["*"]}]';

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {
    hasEnergies.value = params.hasEnergy as boolean ?? false;
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
const toggleExport = (exportKind: "all" | "min"): void => {

    kind.value = exportKind;
    showExport.value = !showExport.value;
    errorMessage.value = "";
    successMessage.value = "";
};

</script>


<template>
<v-app :theme class="d-flex">
  <v-container class="flex-1-1">
    <block-button class="mb-2" label="Export results"
                  @click="toggleExport('all')"/>
    <block-button :disabled="!hasEnergies" label="Min energy per group"
                  @click="toggleExport('min')"/>

  <select-file v-if="showExport" class="ml-n1" title="Select output file"
               :filter="filterPOSCAR" kind="save"
               @selected="selectedExportFile" />
  <v-switch v-if="showExport && hasEnergies" v-model="saveEnergyPerAtom"
               class="ml-2" label="Save energy per atom"/>
  <v-alert v-if="errorMessage !== ''" title="Error" class="mt-4 ml-1 cursor-pointer"
      :text="errorMessage" type="error" density="compact"
      color="red" @click="errorMessage=''" />
  <v-alert v-if="successMessage !== ''" title="Success!" :text="successMessage"
      type="success" density="compact" class="mt-4 ml-1 cursor-pointer"
      @click="successMessage=''"/>
  </v-container>
  <v-container class="d-flex flex-0-1 justify-end">
    <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
  </v-container>
</v-app>
</template>
