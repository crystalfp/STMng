<script setup lang="ts">
/**
 * @component
 * Controls for the symmetry (find and apply) node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-20
 */

import {ref, watch} from "vue";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import type {CtrlParams} from "@/types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Get and set ui parameters from the switchboard
const applyInputSymmetries = ref(true);
const enableFindSymmetries = ref(true);
const standardizeCell = ref(true);
const symprecStandardize = ref(-1);
const symprecDataset = ref(-1);
const fillUnitCell = ref(true);
const showSymmetriesDialog = ref(false);
const standardizeOnly = ref(false);
const inputSpaceGroup = ref("");
const computedSpaceGroup = ref("");

/**
 * Convert in human readable format the exponent of 10
 *
 * @param value - Power of 10 to convert in human readable format
 * @returns The value converted to string (value -3 → 1.00e-3)
 */
const showExponential = (value: number): string => Math.pow(10, value).toExponential(2);

// Initialize the control
resetAlertMessage("symmetries");
askNode(id, "init")
    .then((params) => {

        applyInputSymmetries.value = params.applyInputSymmetries as boolean ?? true;
        enableFindSymmetries.value = params.enableFindSymmetries as boolean ?? true;
        standardizeCell.value = params.standardizeCell as boolean ?? true;
        symprecStandardize.value = params.symprecStandardize as number ?? -1;
        symprecDataset.value = params.symprecDataset as number ?? -1;
        fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
        showSymmetriesDialog.value = params.showSymmetriesDialog as boolean ?? false;
        standardizeOnly.value = params.standardizeOnly as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ComputeSymmetries: ${error.message}`,
                                              "symmetries"));

watch([applyInputSymmetries,
       enableFindSymmetries,
       standardizeCell,
       symprecStandardize,
       symprecDataset,
       fillUnitCell,
       standardizeOnly], () => {

    askNode(id, "compute", {
        applyInputSymmetries: applyInputSymmetries.value,
        enableFindSymmetries: enableFindSymmetries.value,
        standardizeCell: standardizeCell.value,
        symprecStandardize: symprecStandardize.value,
        symprecDataset: symprecDataset.value,
        fillUnitCell: fillUnitCell.value,
        standardizeOnly: standardizeOnly.value
    })
    .then((params) => {
        computedSpaceGroup.value = params.computedSpaceGroup as string ?? "";
    })
    .catch((error: Error) => showAlertMessage(`Error from ComputeSymmetries: ${error.message}`,
                                              "symmetries"));
});

receiveFromNode(id, "show", (params: CtrlParams) => {

    if(params.inSymmetry) inputSpaceGroup.value = params.inSymmetry as string;
    if(params.outSymmetry) computedSpaceGroup.value = params.outSymmetry as string;
    if(params.enableFindSymmetries) enableFindSymmetries.value = params.enableFindSymmetries as boolean;
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="applyInputSymmetries" color="primary"
            label="Apply input symmetries" density="compact" class="mt-2 ml-3" />
  <v-switch v-model="enableFindSymmetries" color="primary"
            label="Enable find symmetries" density="compact" class="ml-3 mt-n5 mb-n6" />
  <v-container v-if="enableFindSymmetries" class="pa-0 mt-n2">
    <v-switch v-model="standardizeCell" color="primary"
              label="Standardize cell" density="compact" class="mt-n5 ml-3" />
    <v-switch v-model="standardizeOnly" color="primary" label="Only standardize cell" class="ml-3 mt-n5" />
  <g-debounced-slider v-show="standardizeCell" v-slot="{value}" v-model="symprecStandardize"
                        :min="-3" :max="0" :step="0.05" class="ml-2 mb-2">
      <v-label :text="`Standardize cell tolerance (${showExponential(value)})`" class="no-select" />
    </g-debounced-slider>
    <g-debounced-slider v-show="!standardizeOnly" v-slot="{value}" v-model="symprecDataset"
                        :min="-3" :max="0" :step="0.05" class="ml-2">
      <v-label :text="`Find symmetries tolerance (${showExponential(value)})`" class="no-select" />
    </g-debounced-slider>
  </v-container>

  <v-row class="pl-2 mt-2 align-center">
    <v-col cols="5">
      <v-label text="Input symmetry:" class="green-label no-select" />
    </v-col>
    <v-col cols="7">
      <v-label :text="inputSpaceGroup" class="show-symmetry" />
    </v-col>
  </v-row>
  <v-row class="pl-2 mt-2 align-center">
    <v-col cols="5">
      <v-label text="Final symmetry:" class="green-label no-select" />
    </v-col>
    <v-col cols="7">
      <v-label :text="computedSpaceGroup" class="show-symmetry" />
    </v-col>
  </v-row>

  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-3 mt-4" />

  <v-btn block class="mb-4" @click="sendToNode(id, 'window')">Show symmetries dialog</v-btn>

  <g-error-alert kind="symmetries"/>
</v-container>
</template>

<style scoped>
.show-symmetry {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-family: monospace;
  font-size: 110%;
}
</style>
