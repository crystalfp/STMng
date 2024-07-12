<script setup lang="ts">
/**
 * @component
 * Controls for fingerprints computation.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";
import {mdiFileOutline} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.fingerprints.message = "";

// Accumulate structures
const reset = ref(false);
const countAccumulated = ref(0);

// Filter structures
const energyFile = ref<File[]>([]);
const energyFileLoading = ref(false);
const enableEnergyThreshold = ref(false);
const thresholdFromMinimum = ref(false);
const energyThreshold = ref("");
const energyThresholdEffective = ref("0");
const countSelected = ref(0);

// Compute fingerprints
const forceCutoff = ref(false);
const cutoffDistance = ref(12);
const manualCutoffDistance = ref(10);
const selectedMethod = ref(0);
const binSize = ref(0.05);
const peakWidth = ref(0.05);
const resultDimensionality = ref(0);
const computeFingerprints = ref(false);

// Compute distances
const selectedDistanceMethod = ref(0);
const fixTriangleInequality = ref(false);
const computeDistances = ref(false);

// Classify structures
const tolerance = ref(0.01);
const absolute = ref(false);

sb.getUiParams(props.id, (params: UiParams) => {
    reset.value = params.reset as boolean ?? false;
    countAccumulated.value = params.countAccumulated as number ?? 0;

    energyFileLoading.value = params.energyFileLoading as boolean ?? false;
    enableEnergyThreshold.value = params.enableEnergyThreshold as boolean ?? false;
    thresholdFromMinimum.value = params.thresholdFromMinimum as boolean ?? false;
    energyThreshold.value = params.energyThreshold as string ?? "0";
    energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
    countSelected.value = params.countSelected as number ?? 0;

    forceCutoff.value = params.forceCutoff as boolean ?? false;
    cutoffDistance.value = params.cutoffDistance as number ?? 12;
    manualCutoffDistance.value = params.manualCutoffDistance as number ?? 10;
    selectedMethod.value = params.selectedMethod as number ?? 0;
    binSize.value = params.binSize as number ?? 0.05;
    peakWidth.value = params.peakWidth as number ?? 0.05;
    resultDimensionality.value = params.resultDimensionality as number ?? 0;

    selectedDistanceMethod.value = params.selectedDistanceMethod as number ?? 0;
    fixTriangleInequality.value = params.fixTriangleInequality as boolean ?? false;
});
watchEffect(() => {

    sb.setUiParams(props.id, {
        reset: reset.value,

        energyFilePath: energyFile.value[0]?.path ?? "",
        enableEnergyThreshold: enableEnergyThreshold.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,

        forceCutoff: forceCutoff.value,
        manualCutoffDistance: manualCutoffDistance.value,
        selectedMethod: selectedMethod.value,
        computeFingerprints: computeFingerprints.value,
        binSize: binSize.value,
        peakWidth: peakWidth.value,

        selectedDistanceMethod: selectedDistanceMethod.value,
        computeDistances: computeDistances.value,
        fixTriangleInequality: fixTriangleInequality.value,
    });
});

// eslint-disable-next-line security/detect-unsafe-regex
const rg = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const rules = {
    numeric: (value: string) => rg.test(value) || "Field should be numeric",
};

const fpMethods = [
    {value: 0, label: "Normalized diffraction"},
    {value: 1, label: "Mendeleev spectra"},
    {value: 2, label: "Chemical scale spectra"},
    {value: 3, label: "Per element diffraction"},
    {value: 4, label: "Distances per atom"},
    {value: 5, label: "Merged distances"},
    {value: 6, label: "Re-centered per element diffraction"},
    {value: 7, label: "Trimmed per element diffraction"},
];

const distanceMethods = [
    {value: 0, label: "Cosine distance"},
    {value: 1, label: "Euclidean distance"},
    {value: 2, label: "Minkowski (p=1/3) distance"},
];

</script>


<template>
<v-container class="container">
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4">Accumulate structures</v-label>

  <v-row class="mx-0 my-4 mr-2">
    <v-label class="green-label">{{ `Structures loaded: ${countAccumulated}` }}</v-label>
    <v-spacer />
    <v-btn density="compact" @click="reset = true">Reset</v-btn>
  </v-row>

  <v-divider thickness="8" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4">Filter structures</v-label>

  <v-file-input v-model="energyFile" label="Select energy file" :loading="energyFileLoading"
                :prepend-icon="mdiFileOutline" accept=".energy,*" :clearable="false" class="mt-2 mr-2" />
  <v-switch v-model="enableEnergyThreshold" color="primary"
            label="Filter by energy" class="ml-2" />
  <v-switch v-model="thresholdFromMinimum" color="primary"
            label="Threshold from minimum energy" class="ml-2 mt-n5" />
  <v-row>
  <v-text-field v-model="energyThreshold" :rules="[rules.numeric]"
                :label="thresholdFromMinimum ? 'Energy from minimum' : 'Max energy'" class="ml-4 mr-2" />
  <v-text-field v-model="energyThresholdEffective" label="Max energy" readonly class="ml-2 mr-5" />
  </v-row>
  <v-label class="mt-4 mb-4 green-label">
    {{ countSelected === countAccumulated ?
      `All ${countAccumulated} structures selected` :
      `Structures selected: ${countSelected} of ${countAccumulated}` }}</v-label>

  <v-divider thickness="8" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4">Compute fingerprints</v-label>

  <v-row class="mt-4 mx-0">
    <v-switch v-model="forceCutoff" color="primary" label="Force cutoff at:" class="ml-2" />
    <v-text-field v-model="manualCutoffDistance" label="Cutoff distance" :disabled="!forceCutoff"
                  class="ml-2 mr-2" :rules="[rules.numeric]" />
  </v-row>

  <v-label class="mt-2 mb-6 green-label">
  {{ forceCutoff ?
    `Forced cutoff: ${manualCutoffDistance.toFixed(2)} (was: ${cutoffDistance.toFixed(2)})` :
    `Computed cutoff: ${cutoffDistance.toFixed(2)}`
  }}
  </v-label>

  <v-select v-model="selectedMethod"
    :items="fpMethods"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-row v-if="selectedMethod < 4 || selectedMethod === 6" class="ml-0 mr-2">
    <v-text-field v-model="binSize" label="Bin size"
                    class="mr-2" :rules="[rules.numeric]" />
    <v-text-field v-model="peakWidth" label="Peak width"
                    :rules="[rules.numeric]" />
  </v-row>
  <v-btn block :disabled="countSelected === 0" @click="computeFingerprints=true">
    Compute fingerprints
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label">
    {{ `Done (dimensionality: ${resultDimensionality})` }}
  </v-label>

  <v-divider thickness="8" class="mt-4" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4 mb-4">Compare structures</v-label>
  <v-select v-model="selectedDistanceMethod"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-switch v-model="fixTriangleInequality" color="primary"
            label="Fix triangle inequality" class="ml-2" />
  <v-btn block :disabled="countSelected === 0" @click="computeDistances=true">
    Compute distances
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label">
    Done
  </v-label>

  <v-divider thickness="8" class="mt-4" />
  <v-label class="text-h5 w-100 justify-center mt-4 mb-4 yellow-title">Classify structures</v-label>
  <v-text-field v-model="tolerance" label="Tolerance"
                  class="ml-2 mr-2" :rules="[rules.numeric]" />
  <v-switch v-model="absolute" color="primary"
            label="Absolute" class="ml-2" />
  <!-- <v-text-field v-if="" v-model="tolerance" label="Best K"
                  class="ml-2 mr-0" :rules="[rules.numeric]" /> -->

  <v-alert v-if="messageStore.fingerprints.message !== ''" title="Error" class="mt-7 cursor-pointer"
           :text="messageStore.fingerprints.message" type="error" density="compact"
           color="red" @click="messageStore.fingerprints.message=''" />

</v-container>
</template>
