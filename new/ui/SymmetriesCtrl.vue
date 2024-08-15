<script setup lang="ts">
/**
 * @component
 * Controls for the symmetry (find and apply) node.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useControlStore} from "../stores/controlStore";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Access the stores
const controlStore = useControlStore();

// > Get and set ui parameters from the switchboard
const applyInputSymmetries = ref(true);
const enableFindSymmetries = ref(true);
const standardizeCell = ref(true);
const symprecStandardize = ref(-1);
const symprecDataset = ref(-1);
const fillUnitCell = ref(true);
const showSymmetriesDialog = ref(false);
const standardizeOnly = ref(false);


const showExponential = (value: number): string => Math.pow(10, value).toExponential(2);


sb.getUiParams(id, (params: UiParams) => {

    applyInputSymmetries.value = params.applyInputSymmetries as boolean ?? true;
    enableFindSymmetries.value = params.enableFindSymmetries as boolean ?? true;
    standardizeCell.value = params.standardizeCell as boolean ?? true;
    symprecStandardize.value = params.symprecStandardize as number ?? -1;
    symprecDataset.value = params.symprecDataset as number ?? -1;
    fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
    showSymmetriesDialog.value = params.showSymmetriesDialog as boolean ?? false;
    standardizeOnly.value = params.standardizeOnly as boolean ?? false;
});

watchEffect(() => {
    sb.setUiParams(id, {
        applyInputSymmetries: applyInputSymmetries.value,
        enableFindSymmetries: enableFindSymmetries.value,
        standardizeCell: standardizeCell.value,
        symprecStandardize: symprecStandardize.value,
        symprecDataset: symprecDataset.value,
        fillUnitCell: fillUnitCell.value,
        showSymmetriesDialog: showSymmetriesDialog.value,
        standardizeOnly: standardizeOnly.value,
    });
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
      <v-label :text="`Standardize cell tolerance (${showExponential(value)})`" />
    </g-debounced-slider>
    <g-debounced-slider v-show="!standardizeOnly" v-slot="{value}" v-model="symprecDataset"
                        :min="-3" :max="0" :step="0.05" class="ml-2">
      <v-label :text="`Find symmetries tolerance (${showExponential(value)})`" />
    </g-debounced-slider>
  </v-container>

  <v-row class="pl-2 mt-2 align-center">
    <v-col cols="5">
      <v-label text="Final symmetry:" class="text-green" />
    </v-col>
    <v-col cols="7">
      <v-label :text="controlStore.computedSpaceGroup" class="show-symmetry" />
    </v-col>
  </v-row>

  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-3 mt-4" />

  <v-btn block class="mb-4" @click="showSymmetriesDialog=true">Show symmetries dialog</v-btn>

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
