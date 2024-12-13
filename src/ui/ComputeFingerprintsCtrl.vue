<script setup lang="ts">
/**
 * @component
 * Controls for fingerprints computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed, watch} from "vue";
import {storeToRefs} from "pinia";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {useControlStore} from "@/stores/controlStore";
import type {CtrlParams, FingerprintingMethodName} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

type FPmethodName = {value: number} & FingerprintingMethodName;

// Prepare the error messages
resetAlertMessage("fingerprints");

// Accumulate structures
const countAccumulated = ref(0);
const areNanoclusters = ref(false);

// Filter structures
const enableEnergyFiltering = ref(false);
const thresholdFromMinimum = ref(false);
const energyThreshold = ref(0);
const energyThresholdEffective = ref("0.0000");
const countSelected = ref(0);

// Compute fingerprints
const forceCutoff = ref(false);
const cutoffDistance = ref(0);
const manualCutoffDistance = ref(10);
const fingerprintMethodsNames = ref<FPmethodName[]>([]);
const selectedMethod = ref(0);
const binSize = ref(0.05);
const peakWidth = ref(0.02);
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
const {fingerprintsAccumulate} = storeToRefs(controlStore);

// > Initialize the ui
askNode(id, "init")
    .then((params) => {

        enableEnergyFiltering.value = params.enableEnergyFiltering as boolean ?? false;
        thresholdFromMinimum.value = params.thresholdFromMinimum as boolean ?? false;
        energyThreshold.value = params.energyThreshold as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
        areNanoclusters.value = params.areNanoclusters as boolean ?? false;

        forceCutoff.value = params.forceCutoff as boolean ?? false;
        manualCutoffDistance.value = params.manualCutoffDistance as number ?? 10;
        cutoffDistance.value = forceCutoff.value ? manualCutoffDistance.value : 0;

        const fpmn = JSON.parse(params.fingerprintMethods as string ?? "[]") as FingerprintingMethodName[];
        const len = fpmn.length;
        fingerprintMethodsNames.value.length = 0;
        for(let i=0; i < len; ++i) fingerprintMethodsNames.value.push({value: i, ...fpmn[i]});

        selectedMethod.value = params.selectedMethod as number ?? 0;
        binSize.value = params.binSize as number ?? 0.05;
        peakWidth.value = params.peakWidth as number ?? 0.02;

        // selectedDistanceMethod.value = params.selectedDistanceMethod as number ?? 0;
        // fixTriangleInequality.value = params.fixTriangleInequality as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`,
                                              "fingerprints"));

receiveFromNode(id, "load", (params) => {

    countSelected.value = params.countSelected as number ?? 0;
    countAccumulated.value = params.countAccumulated as number ?? 0;
    energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
    cutoffDistance.value = params.cutoffDistance as number ?? 0;
    areNanoclusters.value = params.areNanoclusters as boolean ?? false;
});

/**
 * Clear the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
    countSelected.value = 0;
    countAccumulated.value = 0;
};

/** Accumulating button label */
const accumulatingLabel = computed(() => (fingerprintsAccumulate.value ?
                                                            "Stop accumulating" :
                                                            "Start accumulating"));
/**
 * Start/stop accumulating structures
 */
const toggleAccumulating = (): void => {

    controlStore.fingerprintsAccumulate = !controlStore.fingerprintsAccumulate;

    askNode(id, "capture", {
        fingerprintsAccumulate: controlStore.fingerprintsAccumulate,
        areNanoclusters: areNanoclusters.value
    })
    .then((params) => {
        setTimeout(() => {
            countSelected.value = params.countSelected as number ?? 0;
            countAccumulated.value = params.countAccumulated as number ?? 0;
            cutoffDistance.value = params.cutoffDistance as number ?? 0;
            areNanoclusters.value = params.areNanoclusters as boolean ?? false;
        }, 50);
    })
    .catch((error: Error) => showAlertMessage(`Error from toggle capture for ${label}: ${error.message}`,
                                              "fingerprints"));
};

/**
 * Select and load the energy file
 *
 * @param filename - Energy file to be loaded
 */
const selectEnergyFile = (filename: string): void => {

    askNode(id, "energy", {
        filename,
        enableEnergyFiltering: enableEnergyFiltering.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,
    })
    .then((params) => {
        countSelected.value = params.countSelected as number ?? 0;
        countAccumulated.value = params.countAccumulated as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
        cutoffDistance.value = params.cutoffDistance as number ?? 0;
    })
    .catch((error: Error) => {
        showAlertMessage(`Error reading energy file: ${error.message}`, "fingerprints");
    });
};

/** The JSON encoded filter for the energy file */
const energyFileFilter = '[{"name":"Energies","extensions":["energy"]},{"name":"All","extensions":["*"]}]';

/** Count of the structures selected */
const accumulatedLabel = computed(() => {
    if(countSelected.value === 0) return "No structure selected";
    if(countSelected.value === countAccumulated.value) return `All ${countAccumulated.value} structures selected`;
    return `Structures selected: ${countSelected.value} of ${countAccumulated.value}`;
});

/** On change of the energy filtering parameters */
watch([enableEnergyFiltering, thresholdFromMinimum, energyThreshold], () => {

    askNode(id, "energy", {

        enableEnergyFiltering: enableEnergyFiltering.value,
        thresholdFromMinimum: thresholdFromMinimum.value,
        energyThreshold: energyThreshold.value,
    })
    .then((params: CtrlParams) => {
        countSelected.value = params.countSelected as number ?? 0;
        countAccumulated.value = params.countAccumulated as number ?? 0;
        energyThresholdEffective.value = (params.energyThresholdEffective as number ?? 0).toFixed(4);
        cutoffDistance.value = params.cutoffDistance as number ?? 0;
    })
    .catch((error: Error) => showAlertMessage(`Error from energy settings for ${label}: ${error.message}`,
                                              "fingerprints"));
});

watch([forceCutoff, manualCutoffDistance], () => {

    askNode(id, "cutoff", {
        forceCutoff: forceCutoff.value,
        manualCutoffDistance: manualCutoffDistance.value,
    })
    .then((params: CtrlParams) => {

        cutoffDistance.value = params.cutoffDistance as number ?? manualCutoffDistance.value;
    })
    .catch((error: Error) => showAlertMessage(`Error from cutoff setting for ${label}: ${error.message}`,
                                              "fingerprints"));

});

const cutoffLabel = computed(() => {

    if(cutoffDistance.value === 0) return "No cutoff defined";
    return forceCutoff.value ?
        `Forced cutoff: ${manualCutoffDistance.value.toFixed(2)}`:
        `Computed cutoff: ${cutoffDistance.value.toFixed(2)}`;
});

// eslint-disable-next-line security/detect-unsafe-regex
const rg = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const rules = {
    numeric: (value: string): boolean | string => rg.test(value) || "Field should be numeric",
    positive: (value: string): boolean | string => Number.parseFloat(value) > 0 || "Field should be > 0",
};

const distanceMethods = [
    {value: 0, label: "Cosine distance"},
    {value: 1, label: "Euclidean distance"},
    {value: 2, label: "Minkowski (p=1/3) distance"},
];

/**
 * Start computing fingerprints
 */
const computeFingerprints = (): void => {

    askNode(id, "fp", {
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
  <v-label class="separator-title">Accumulate structures</v-label>

  <v-row class="mx-0 my-4 mx-2">
    <v-label class="green-label">{{ `Structures loaded: ${countAccumulated}` }}</v-label>
    <v-spacer />
    <v-btn density="compact" variant="tonal" @click="resetAccumulator">Reset</v-btn>
  </v-row>
  <v-switch v-model="areNanoclusters" color="primary"
            label="Structures are nanoclusters" class="ml-2 my-n3" />
  <v-btn variant="tonal" block class="m2-4" @click="toggleAccumulating">{{ accumulatingLabel }}</v-btn>

  <v-label class="separator-title">Filter structures</v-label>

  <g-select-file class="mt-2 mr-2" title="Select energy file"
                 :filter="energyFileFilter" @selected="selectEnergyFile" />

  <v-switch v-model="enableEnergyFiltering" color="primary"
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

  <v-label class="mt-2 mb-2 green-label"> {{ accumulatedLabel }}</v-label>

  <v-label class="separator-title">Compute fingerprints</v-label>

  <v-row class="mt-4 mx-0">
    <v-switch v-model="forceCutoff" color="primary" label="Force cutoff at:" class="ml-2" />
    <v-number-input controlVariant="stacked" variant="filled" v-model="manualCutoffDistance"
                    label="Cutoff distance" :min="0.1" :step="0.1" :disabled="!forceCutoff"
                    class="mx-2" />
  </v-row>

  <v-label class="mt-2 mb-6 green-label">{{ cutoffLabel }}</v-label>

  <v-select v-model="selectedMethod"
    :items="fingerprintMethodsNames"
    label="Selection method"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-row v-if="fingerprintMethodsNames[selectedMethod]?.needSizes" class="ml-0 mr-2 pt-1">
    <v-number-input controlVariant="stacked" variant="filled" v-model="binSize"
                    label="Bin size" :min="0.01" :step="0.01" class="mr-2" />
    <v-number-input controlVariant="stacked" variant="filled" v-model="peakWidth"
                    label="Peak width" :min="0.01" :step="0.01" />
  </v-row>
  <v-btn block variant="tonal" :disabled="countSelected === 0" @click="computeFingerprints">
    Compute fingerprints
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label">
    {{ `Done (dimensionality: ${resultDimensionality})` }}
  </v-label>

  <v-label class="separator-title">Compare structures</v-label>
  <v-select v-model="selectedDistanceMethod"
    label="Distance method"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    density="compact" class="mr-2" />

  <v-switch v-model="fixTriangleInequality" color="primary"
            label="Fix triangle inequality" class="ml-2" />
  <v-btn block variant="tonal" :disabled="countSelected === 0" @click="computeDistances=true">
    Compute distances
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 green-label">
    Done
  </v-label>

  <v-label class="separator-title">Classify structures</v-label>
  <v-text-field v-model="tolerance" label="Tolerance"
                  class="ml-2 mr-2" :rules="[rules.numeric]" />
  <v-switch v-model="absolute" color="primary"
            label="Absolute" class="ml-2" />
  <!-- <v-text-field v-if="" v-model="tolerance" label="Best K"
                  class="ml-2 mr-0" :rules="[rules.numeric]" /> -->

  <g-error-alert kind="fingerprints" />
</v-container>
</template>
