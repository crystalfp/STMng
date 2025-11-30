<script setup lang="ts">
/**
 * @component
 * Controls for the symmetry find and apply node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-20
 */

import {ref, watch} from "vue";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import type {CtrlParams} from "@/types";

import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";
import DebouncedButton from "@/widgets/DebouncedButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Get and set ui parameters from the switchboard
const applyInputSymmetries = ref(true);
const disableInputSymmetries = ref(false);
const enableFindSymmetries = ref(true);
const standardizeCell = ref(true);
const symprecStandardize = ref(-1);
const symprecDataset = ref(-1);
const fillUnitCell = ref(true);
const showSymmetriesDialog = ref(false);
const standardizeOnly = ref(false);
const inputSpaceGroup = ref("");
const computedSpaceGroup = ref("");
const intlSymbol = ref("");
const showIntlSymbol = ref(false);
const fillTolerance = ref(-5);
const createPrimitiveCell = ref(false);

const computePointGroup = ref(false);
const pointGroup = ref("");
const positionTolerance = ref(0.3);
const eigenvalueTolerance = ref(0.01);

/**
 * Convert in human readable format the exponent of 10
 *
 * @param value - Power of 10 to convert in human readable format
 * @returns The value converted to string (value -3 → 1.00e-3)
 */
const showExponential = (value: number): string => (10**value).toExponential(2);

// Initialize the control
resetNodeAlert();
askNode(id, "init")
    .then((params) => {

        applyInputSymmetries.value = params.applyInputSymmetries as boolean ?? true;
        enableFindSymmetries.value = params.enableFindSymmetries as boolean ?? true;
        standardizeCell.value = params.standardizeCell as boolean ?? true;
        symprecStandardize.value = params.symprecStandardize as number ?? -1;
        symprecDataset.value = params.symprecDataset as number ?? -1;
        fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
        fillTolerance.value = params.fillTolerance as number ?? -5;
        showSymmetriesDialog.value = params.showSymmetriesDialog as boolean ?? false;
        standardizeOnly.value = params.standardizeOnly as boolean ?? false;
        createPrimitiveCell.value = params.createPrimitiveCell as boolean ?? false;

        computePointGroup.value = params.computePointGroup as boolean ?? false;
        pointGroup.value = params.pointGroup as string ?? "";
        positionTolerance.value = params.positionTolerance as number ?? 0.3;
        eigenvalueTolerance.value = params.eigenvalueTolerance as number ?? 0.01;
        intlSymbol.value = params.intlSymbol as string ?? "";
        showIntlSymbol.value = params.showIntlSymbol as boolean ?? false;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                      "symmetries");
    });

watch([applyInputSymmetries,
       enableFindSymmetries,
       standardizeCell,
       symprecStandardize,
       symprecDataset,
       fillUnitCell,
       fillTolerance,
       createPrimitiveCell,
       standardizeOnly], () => {

    sendToNode(id, "compute", {
        applyInputSymmetries: applyInputSymmetries.value,
        enableFindSymmetries: enableFindSymmetries.value,
        standardizeCell: standardizeCell.value,
        symprecStandardize: symprecStandardize.value,
        symprecDataset: symprecDataset.value,
        fillUnitCell: fillUnitCell.value,
        fillTolerance: fillTolerance.value,
        standardizeOnly: standardizeOnly.value,
        createPrimitiveCell: createPrimitiveCell.value
    });
});

watch([
    computePointGroup,
    positionTolerance,
    eigenvalueTolerance
], () => {

    sendToNode(id, "do-point-group", {
        computePointGroup: computePointGroup.value,
        positionTolerance: positionTolerance.value,
        eigenvalueTolerance: eigenvalueTolerance.value,
    });
});

watch(showIntlSymbol, () => {
    sendToNode(id, "intl", {showIntlSymbol: showIntlSymbol.value});
});

receiveFromNode(id, "show", (params: CtrlParams) => {

    if(params.inSymmetry !== undefined) inputSpaceGroup.value = params.inSymmetry as string;
    if(params.outSymmetry !== undefined) computedSpaceGroup.value = params.outSymmetry as string;
    if(params.enableFindSymmetries !== undefined) enableFindSymmetries.value = params.enableFindSymmetries as boolean;
    if(params.pointGroup !== undefined) pointGroup.value = params.pointGroup as string;
    if(params.intlSymbol !== undefined) intlSymbol.value = params.intlSymbol as string;
});

receiveFromNode(id, "input-symmetries", (params: CtrlParams) => {

    if(params.noInputSymmetries === undefined) return;

    const noInputSymmetries = params.noInputSymmetries as boolean;
    if(noInputSymmetries) {
        disableInputSymmetries.value = true;
        applyInputSymmetries.value = false;
    }
    else {
        disableInputSymmetries.value = false;
        applyInputSymmetries.value = params.applyInputSymmetries as boolean ?? true;
    }
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="applyInputSymmetries" :disabled="disableInputSymmetries"
            label="Apply input symmetries" class="mt-2 ml-3" />
  <v-switch v-model="enableFindSymmetries"
            label="Enable find symmetries" class="ml-3 mt-n2" />
  <v-container v-if="enableFindSymmetries" class="pa-0 mt-n2">
    <v-switch v-model="standardizeCell" label="Standardize cell" class="ml-3" />
    <v-container v-if="standardizeCell" class="pa-0 mt-n2">
      <v-switch v-model="standardizeOnly" label="Only standardize cell" class="ml-3 mt-n2" />
      <v-switch v-model="createPrimitiveCell" label="Primitive cell" class="ml-3 mt-n2" />
      <v-switch v-model="showIntlSymbol" label="Show international symbol" class="ml-3 mt-n2" />
      <debounced-slider v-show="standardizeCell" v-slot="{value}" v-model="symprecStandardize"
                        :min="-3" :max="0" :step="0.02" class="ml-2 mt-4">
        <v-label :text="`Standardize cell tolerance (${showExponential(value)})`" class="no-select" />
      </debounced-slider>
    </v-container>
    <debounced-slider v-show="!standardizeOnly" v-slot="{value}" v-model="symprecDataset"
                        :min="-3" :max="0" :step="0.02" class="ml-2 mt-2">
      <v-label :text="`Find symmetries tolerance (${showExponential(value)})`" class="no-select" />
    </debounced-slider>
  </v-container>

  <v-container v-if="!disableInputSymmetries" class="pl-6 mt-2">
    <v-row>
      <v-label text="Input symmetry:" class="result-label no-select" />
    </v-row>
    <v-row>
      <v-label :text="inputSpaceGroup" class="show-symmetry" />
    </v-row>
  </v-container>
  <v-container v-if="enableFindSymmetries" class="pl-6 mt-2">
    <v-row>
      <v-label text="Final symmetry:" class="result-label no-select" />
    </v-row>
    <v-row>
      <v-label :text="showIntlSymbol ? intlSymbol : computedSpaceGroup" class="show-symmetry" />
    </v-row>
  </v-container>

  <v-switch v-model="fillUnitCell" label="Fill unit cell" class="ml-3 mt-4 mb-n2" />
  <debounced-slider v-show="fillUnitCell" v-slot="{value}" v-model="fillTolerance"
                      :min="-5" :max="-1" :step="0.02" class="ml-2 mb-3 mt-6">
    <v-label :text="`Fill unit cell tolerance (${showExponential(value)})`" class="no-select" />
  </debounced-slider>

  <v-switch v-model="computePointGroup" label="Compute point group" class="ml-3 mb-4" />
  <v-container v-if="computePointGroup" class="pa-0">
    <debounced-slider v-slot="{value}" v-model="positionTolerance"
                      :min="0.01" :max="1" :step="0.01" class="ml-2 mb-2 mt-4">
      <v-label :text="`Position tolerance (${value})`" class="no-select" />
    </debounced-slider>
    <debounced-slider v-slot="{value}" v-model="eigenvalueTolerance"
                      :min="0.001" :max="0.1" :step="0.001" class="ml-2 mb-4 mt-2">
      <v-label :text="`Eigenvalues tolerance (${value})`" class="no-select" />
    </debounced-slider>
    <v-row class="pl-2 mb-4 align-center">
      <v-col cols="5">
        <v-label text="Point group:" class="result-label no-select" />
      </v-col>
      <v-col cols="7">
        <v-label :text="pointGroup" class="show-symmetry" />
      </v-col>
    </v-row>
  </v-container>

  <debounced-button block class="mb-4" label="Show symmetries dialog"
                    @click="sendToNode(id, 'window')" />

  <node-alert node="symmetries" />
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
