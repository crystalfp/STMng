<script setup lang="ts">
/**
 * @component
 * Controls for fingerprints computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watchEffect, computed, watch} from "vue";
import {storeToRefs} from "pinia";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {useControlStore} from "@/stores/controlStore";
import type {CtrlParams} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Prepare the error messages
resetAlertMessage("fingerprints");

// Accumulate structures
const countAccumulated = ref(0);

// Filter structures
const enableEnergyThreshold = ref(false);
const thresholdFromMinimum = ref(false);
const energyThreshold = ref(0);
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

// Compute distances
const selectedDistanceMethod = ref(0);
const fixTriangleInequality = ref(false);
const computeDistances = ref(false);

// Classify structures
const tolerance = ref(0.01);
const absolute = ref(false);

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasFingerprints = true;

// > Initialize the ui
askNode(id, "init")
    .then((params) => {

        enableEnergyThreshold.value = params.enableEnergyThreshold as boolean ?? false;
        thresholdFromMinimum.value = params.thresholdFromMinimum as boolean ?? false;
        energyThreshold.value = params.energyThreshold as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);

        forceCutoff.value = params.forceCutoff as boolean ?? false;
        cutoffDistance.value = params.cutoffDistance as number ?? 12;
        manualCutoffDistance.value = params.manualCutoffDistance as number ?? 10;
        selectedMethod.value = params.selectedMethod as number ?? 0;
        binSize.value = params.binSize as number ?? 0.05;
        peakWidth.value = params.peakWidth as number ?? 0.05;
        resultDimensionality.value = params.resultDimensionality as number ?? 0;

        selectedDistanceMethod.value = params.selectedDistanceMethod as number ?? 0;
        fixTriangleInequality.value = params.fixTriangleInequality as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`,
                                              "fingerprints"));

receiveFromNode(id, "load", (params) => {

    countSelected.value = params.countSelected as number ?? 0;
    countAccumulated.value = params.countAccumulated as number ?? 0;
});

/**
 * Clear the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
    countSelected.value = 0;
    countAccumulated.value = 0;
};

const {fingerprintsAccumulate} = storeToRefs(controlStore);

watch([enableEnergyThreshold, thresholdFromMinimum, energyThreshold, fingerprintsAccumulate], () => {

    askNode(id, "threshold", {

        enableEnergyThreshold: enableEnergyThreshold.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,
        fingerprintsAccumulate: fingerprintsAccumulate.value,
    })
    .then((params: CtrlParams) => {
        countSelected.value = params.countSelected as number ?? 0;
        countAccumulated.value = params.countAccumulated as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
    })
    .catch((error: Error) => showAlertMessage(`Error from energy settings for ${label}: ${error.message}`,
                                              "fingerprints"));
});

watchEffect(() => {

      sendToNode(id, "change", {

        forceCutoff: forceCutoff.value,
        manualCutoffDistance: manualCutoffDistance.value,
        selectedMethod: selectedMethod.value,
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
    numeric: (value: string): boolean | string => rg.test(value) || "Field should be numeric",
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

const selectEnergyFile = (filename: string): void => {

    askNode(id, "energy", {
        filename,
        enableEnergyThreshold: enableEnergyThreshold.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,
    })
    .then((params) => {
        countSelected.value = params.countSelected as number ?? 0;
        countAccumulated.value = params.countAccumulated as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
    })
    .catch((error: Error) => {
        showAlertMessage(`Error reading energy file: ${error.message}`, "fingerprints");
    });
};

/** The JSON encoded filter for the energy file */
const energyFileFilter = '[{"name":"Energies","extensions":["energy"]},{"name":"All","extensions":["*"]}]';

const accumulatedLabel = computed(() => {
    if(countSelected.value === 0) return "No structure selected";
    if(countSelected.value === countAccumulated.value) return `All ${countAccumulated.value} structures selected`;
    return `Structures selected: ${countSelected.value} of ${countAccumulated.value}`;
});

/**
 * Start computing fingerprints
 */
const computeFingerprints = (): void => {

    askNode(id, "fp", {
        forceCutoff: forceCutoff.value,
        manualCutoffDistance: manualCutoffDistance.value,
		selectedMethod: selectedMethod.value,
        binSize: binSize.value,
        peakWidth: peakWidth.value
    })
    .then((params: CtrlParams) => {
        resultDimensionality.value = params.resultDimensionality as number ?? 0;
    })
    .catch((error: Error) => showAlertMessage(`Error from fingerprint computation: ${error.message}`,
                                              "fingerprints"));
};

</script>


<template>
<v-container class="container">
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4 no-select">Accumulate structures</v-label>

  <v-row class="mx-0 my-4 mr-2">
    <v-label class="green-label no-select">{{ `Structures loaded: ${countAccumulated}` }}</v-label>
    <v-spacer />
    <v-btn density="compact" @click="resetAccumulator">Reset</v-btn>
  </v-row>

  <v-divider thickness="8" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4 no-select">Filter structures</v-label>

  <g-select-file class="mt-2 mr-2" title="Select energy file"
                 :filter="energyFileFilter" @selected="selectEnergyFile" />

  <v-switch v-model="enableEnergyThreshold" color="primary"
            label="Filter by energy" class="ml-2" />
  <v-switch v-model="thresholdFromMinimum" color="primary"
            label="Threshold from minimum energy" class="ml-2 mt-n5" />
  <v-row>
    <v-number-input controlVariant="stacked" variant="filled" v-model="energyThreshold"
                    :label="thresholdFromMinimum ? 'Energy from minimum' : 'Max energy'" :step="0.1"
                    class="ml-4 mr-2" />
    <v-text-field controlVariant="stacked" variant="filled" v-model="energyThresholdEffective"
                    label="Max energy" readonly class="ml-2 mr-5" />
  </v-row>

  <v-label class="mt-4 mb-4 green-label no-select"> {{ accumulatedLabel }}</v-label>

  <v-divider thickness="8" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4 no-select">Compute fingerprints</v-label>

  <v-row class="mt-4 mx-0">
    <v-switch v-model="forceCutoff" color="primary" label="Force cutoff at:" class="ml-2" />
    <v-text-field v-model="manualCutoffDistance" label="Cutoff distance" :disabled="!forceCutoff"
                  class="ml-2 mr-2" :rules="[rules.numeric]" />
  </v-row>

  <v-label class="mt-2 mb-6 green-label no-select">
  {{ forceCutoff ?
    `Forced cutoff: ${manualCutoffDistance.toFixed(2)} (was: ${cutoffDistance.toFixed(2)})` :
    `Computed cutoff: ${cutoffDistance.toFixed(2)}`
  }}
  </v-label>

  <v-select v-model="selectedMethod"
    :items="fpMethods"
    label="Selection method"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-row v-if="selectedMethod < 4 || selectedMethod === 6" class="ml-0 mr-2">
    <v-text-field v-model="binSize" label="Bin size"
                    class="mr-2" :rules="[rules.numeric]" />
    <v-text-field v-model="peakWidth" label="Peak width"
                    :rules="[rules.numeric]" />
  </v-row>
  <v-btn block :disabled="countSelected === 0" @click="computeFingerprints">
    Compute fingerprints
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label no-select">
    {{ `Done (dimensionality: ${resultDimensionality})` }}
  </v-label>

  <v-divider thickness="8" class="mt-4" />
  <v-label class="text-h5 w-100 justify-center yellow-title mt-4 mb-4 no-select">Compare structures</v-label>
  <v-select v-model="selectedDistanceMethod"
    label="Distance method"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-switch v-model="fixTriangleInequality" color="primary"
            label="Fix triangle inequality" class="ml-2" />
  <v-btn block :disabled="countSelected === 0" @click="computeDistances=true">
    Compute distances
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label no-select">
    Done
  </v-label>

  <v-divider thickness="8" class="mt-4" />
  <v-label class="text-h5 w-100 justify-center mt-4 mb-4 yellow-title no-select">Classify structures</v-label>
  <v-text-field v-model="tolerance" label="Tolerance"
                  class="ml-2 mr-2" :rules="[rules.numeric]" />
  <v-switch v-model="absolute" color="primary"
            label="Absolute" class="ml-2" />
  <!-- <v-text-field v-if="" v-model="tolerance" label="Best K"
                  class="ml-2 mr-0" :rules="[rules.numeric]" /> -->

  <g-error-alert kind="fingerprints" />
</v-container>
</template>
