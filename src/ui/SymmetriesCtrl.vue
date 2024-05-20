<script setup lang="ts">
/**
 * @component
 * Controls for the symmetry (find and apply) node.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";
import {useConfigStore} from "@/stores/configStore";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Access the stores
const messageStore = useMessageStore();
const configStore = useConfigStore();

// > Get and set ui parameters from the switchboard
const applyInputSymmetries = ref(true);
const enableFindSymmetries = ref(true);
const standardizeCell = ref(true);
const symprecStandardize = ref(-5);
const symprecDataset = ref(-5);
const fillUnitCell = ref(true);
const showSymmetriesDialog = ref(false);

const showExponential = (value: number): string => Math.pow(10, value).toExponential(2);


sb.getUiParams(pr.id, (params: UiParams) => {

    applyInputSymmetries.value = params.applyInputSymmetries as boolean ?? true;
    enableFindSymmetries.value = params.enableFindSymmetries as boolean ?? true;
    standardizeCell.value = params.standardizeCell as boolean ?? true;
    symprecStandardize.value = params.symprecStandardize as number ?? -5;
    symprecDataset.value = params.symprecDataset as number ?? -5;
    fillUnitCell.value  = params.fillUnitCell as boolean ?? true;
    showSymmetriesDialog.value = params.showSymmetriesDialog as boolean ?? false;
});

watchEffect(() => {
    sb.setUiParams(pr.id, {
        applyInputSymmetries: applyInputSymmetries.value,
        enableFindSymmetries: enableFindSymmetries.value,
        standardizeCell: standardizeCell.value,
        symprecStandardize: symprecStandardize.value,
        symprecDataset: symprecDataset.value,
        fillUnitCell: fillUnitCell.value,
        showSymmetriesDialog: showSymmetriesDialog.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="applyInputSymmetries" color="primary"
            label="Apply input symmetries" density="compact" class="mt-2 ml-3" />
  <v-switch v-model="enableFindSymmetries" color="primary"
            label="Enable find symmetries" density="compact" class="ml-3" />
  <v-container v-if="enableFindSymmetries" class="pa-0 mt-n2">
    <v-switch v-model="standardizeCell" color="primary"
              label="Standardize cell" density="compact" class="mt-2 ml-3" />
    <g-debounced-slider v-show="standardizeCell" v-slot="{value}" v-model="symprecStandardize"
                        :min="-5" :max="-1" :step="0.2" class="mb-n4">
      <v-label :text="`Standardize cell tolerance (${showExponential(value)})`" class="ml-2" />
    </g-debounced-slider>
    <g-debounced-slider v-slot="{value}" v-model="symprecDataset" :min="-5" :max="-1" :step="0.2">
      <v-label :text="`Find symmetries tolerance (${showExponential(value)})`" class="ml-2" />
    </g-debounced-slider>
  </v-container>

  <v-row class="pl-2 align-center">
    <v-col cols="5">
      <v-label text="Final symmetry:" class="text-green" />
    </v-col>
    <v-col cols="7">
      <v-label :text="configStore.control.computedSpaceGroup" class="show-symmetry" />
    </v-col>
  </v-row>

  <v-switch v-model="fillUnitCell" color="primary" label="Fill unit cell" class="ml-3 mt-4" />

  <v-btn block class="mb-4" @click="showSymmetriesDialog=true">Show symmetries dialog</v-btn>

  <v-alert v-if="messageStore.symmetries.message !== ''" title="Error"
           :text="messageStore.symmetries.message" type="error" density="compact" color="red"
           class="cursor-pointer" @click="messageStore.symmetries.message=''" />
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
