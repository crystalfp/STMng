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
import type {CtrlParams} from "@/types";
import type {GroupingMethodName} from "@/electron/fingerprint/Grouping";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Type of the list of fingerprinting methods names for selection */
interface FPmethodName {
    value: number;
    label: string;
}

/** Type of the list of distance methods names for selection */
interface DistanceMethodsNames {
    value: number;
    label: string;
}

/** Type of the list of grouping methods names for selection */
interface GroupingMethodsNames {
    value: number;
    label: string;
    usingMargin: boolean;
}

// Prepare the error messages
resetAlertMessage("fingerprints");

// Accumulate structures
const countAccumulated = ref(0);
const areNanoclusters = ref(false);
const haveEnergies = ref(false);

// Filter structures
const enableEnergyFiltering = ref(false);
const thresholdFromMinimum = ref(false);
const energyThreshold = ref(0);
const energyThresholdEffective = ref(0);
const countSelected = ref(0);

// Compute fingerprints
const forceCutoff = ref(false);
const cutoffDistance = ref(0);
const manualCutoffDistance = ref(10);
const fingerprintMethodsNames = ref<FPmethodName[]>([]);
const fingerprintingMethod = ref(0);
const binSize = ref(0.05);
const peakWidth = ref(0.02);
const resultDimensionality = ref(0);
const fingerprintingBusy = ref(false);

// Compute distances
const distanceMethod = ref(0);
const fixTriangleInequality = ref(false);
const distanceMethods = ref<DistanceMethodsNames[]>([]);
const countDistances = ref(0);
const endMessage = ref("");

// Remove duplicates
const removeDuplicates = ref(true);
const duplicatesThreshold = ref(0.05);
const pointsRemoved = ref(-1); // -1 means not run yet

// Classify structures
const groupingMethods = ref<GroupingMethodsNames[]>([]);
const groupingMethod = ref(0);
const groupingThreshold = ref(0.1);
const addedMargin = ref(0); // (1+addedMargin) was called "K" in the old code
const countGroups = ref(0);
const groupingBusy = ref(false);

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
        energyThresholdEffective.value = params.energyThresholdEffective as number ?? 0;
        areNanoclusters.value = params.areNanoclusters as boolean ?? false;
        haveEnergies.value = false;

        forceCutoff.value = params.forceCutoff as boolean ?? false;
        manualCutoffDistance.value = params.manualCutoffDistance as number ?? 10;
        cutoffDistance.value = forceCutoff.value ? manualCutoffDistance.value : 0;

        const fpmn = params.fingerprintMethods as string[] ?? [];
        let len = fpmn.length;
        fingerprintMethodsNames.value.length = 0;
        for(let i=0; i < len; ++i) fingerprintMethodsNames.value.push({value: i, label: fpmn[i]});

        fingerprintingMethod.value = params.fingerprintingMethod as number ?? 0;
        binSize.value = params.binSize as number ?? 0.05;
        peakWidth.value = params.peakWidth as number ?? 0.02;

        const dms = JSON.parse(params.distanceMethods as string ?? "[]") as string[];
        len = dms.length;
        distanceMethods.value.length = 0;
        for(let i=0; i < len; ++i) distanceMethods.value.push({value: i, label: dms[i]});

        distanceMethod.value = params.distanceMethod as number ?? 0;
        fixTriangleInequality.value = params.fixTriangleInequality as boolean ?? false;

        const gms = JSON.parse(params.groupingMethods as string ?? "[]") as GroupingMethodName[];
        len = gms.length;
        groupingMethods.value.length = 0;
        for(let i=0; i < len; ++i) {
            groupingMethods.value.push({value: i, label: gms[i].label, usingMargin: gms[i].usingMargin});
        }
        groupingMethod.value = params.groupingMethod as number ?? 0;
        groupingThreshold.value = params.groupingThreshold as number ?? 0.1;
        addedMargin.value = params.addedMargin as number ?? 0;

        removeDuplicates.value = params.removeDuplicates as boolean ?? true;
        duplicatesThreshold.value = params.duplicatesThreshold as number ?? 0.05;

        countSelected.value = 0;
        countAccumulated.value = 0;
        resultDimensionality.value = 0;
        countDistances.value = 0;
        countGroups.value = 0;
        pointsRemoved.value = -1;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`,
                                              "fingerprints"));

/** Receive the parameters of structure loaded */
receiveFromNode(id, "load", (params) => {

    countSelected.value = params.countSelected as number ?? 0;
    countAccumulated.value = params.countAccumulated as number ?? 0;
    energyThresholdEffective.value = params.energyThresholdEffective as number ?? 0;
    cutoffDistance.value = params.cutoffDistance as number ?? 0;
    areNanoclusters.value = params.areNanoclusters as boolean ?? false;
});

/** Update the energies present status */
receiveFromNode(id, "has-energies", (params) => {

    haveEnergies.value = params.haveEnergies as boolean ?? false;
});

/**
 * Clear the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
    countSelected.value = 0;
    countAccumulated.value = 0;
    resultDimensionality.value = 0;
    countDistances.value = 0;
    countGroups.value = 0;
    haveEnergies.value = false;
    pointsRemoved.value = -1;
};

/** Changes accumulating structures request */
watch([fingerprintsAccumulate], () => {

    askNode(id, "capture", {
        fingerprintsAccumulate: controlStore.fingerprintsAccumulate!,
        areNanoclusters: areNanoclusters.value!
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
});

/** Count of the structures selected */
const accumulatedLabel = computed(() => {
    if(countSelected.value === 0) return "No structure selected";
    if(countSelected.value === countAccumulated.value) return `All ${countAccumulated.value} structures selected`;
    return `Structures selected: ${countSelected.value} of ${countAccumulated.value}`;
});

/** On change of the energy filtering parameters */
watch([enableEnergyFiltering, thresholdFromMinimum, energyThreshold], () => {

    askNode(id, "energy", {

        enableEnergyFiltering: enableEnergyFiltering.value!,
        thresholdFromMinimum: thresholdFromMinimum.value!,
        energyThreshold: energyThreshold.value,
    })
    .then((params: CtrlParams) => {
        countSelected.value = params.countSelected as number ?? 0;
        countAccumulated.value = params.countAccumulated as number ?? 0;
        energyThresholdEffective.value = params.energyThresholdEffective as number ?? 0;
        cutoffDistance.value = params.cutoffDistance as number ?? 0;
    })
    .catch((error: Error) => showAlertMessage(`Error from energy settings for ${label}: ${error.message}`,
                                              "fingerprints"));
});

/** On changing manual cutoff distance */
watch([forceCutoff, manualCutoffDistance], () => {

    askNode(id, "cutoff", {
        forceCutoff: forceCutoff.value!,
        manualCutoffDistance: manualCutoffDistance.value,
    })
    .then((params: CtrlParams) => {

        cutoffDistance.value = params.cutoffDistance as number ?? manualCutoffDistance.value;

        resultDimensionality.value = 0;
        countDistances.value = 0;
        countGroups.value = 0;
    })
    .catch((error: Error) => showAlertMessage(`Error from cutoff setting for ${label}: ${error.message}`,
                                              "fingerprints"));

});

/** Cutoff type label for the UI */
const cutoffLabel = computed(() => {

    if(cutoffDistance.value === 0 ||
      (forceCutoff.value && !manualCutoffDistance.value)) return "No cutoff defined";
    return forceCutoff.value ?
        `Forced cutoff: ${manualCutoffDistance.value.toFixed(2)}`:
        `Computed cutoff: ${cutoffDistance.value.toFixed(2)}`;
});

/** On fingerprinting parameters change */
watch([fingerprintingMethod, binSize, peakWidth], () => {

    resultDimensionality.value = 0;
    countDistances.value = 0;
    countGroups.value = 0;

    sendToNode(id, "fp-params", {
        fingerprintingMethod: fingerprintingMethod.value,
        binSize: binSize.value,
        peakWidth: peakWidth.value
    });
});

/**
 * Start computing fingerprints
 */
const computeFingerprints = (): void => {

    resultDimensionality.value = 0;
    countDistances.value = 0;
    countGroups.value = 0;

    askNode(id, "fp", {
        fingerprintingMethod: fingerprintingMethod.value,
        binSize: binSize.value,
        peakWidth: peakWidth.value,
        distanceMethod: distanceMethod.value,
        fixTriangleInequality: fixTriangleInequality.value!,
        removeDuplicates: removeDuplicates.value!,
        duplicatesThreshold: duplicatesThreshold.value
    })
    .then((params: CtrlParams) => {
        resultDimensionality.value = params.resultDimensionality as number ?? 0;
        countDistances.value = params.countDistances as number ?? 0;
        endMessage.value = params.endMessage as string ?? "";
        pointsRemoved.value = params.pointsRemoved as number ?? -1;
    })
    .catch((error: Error) => showAlertMessage(`Error from fingerprint computation: ${error.message}`,
                                              "fingerprints"))
    .finally(() => fingerprintingBusy.value = false);
};

/** On changing distance computation parameters */
watch([distanceMethod, fixTriangleInequality], () => {

    countDistances.value = 0;
    countGroups.value = 0;

    if(resultDimensionality.value === 0 || countAccumulated.value < 2) return;

    askNode(id, "dist", {
        distanceMethod: distanceMethod.value,
        fixTriangleInequality: fixTriangleInequality.value!,
        removeDuplicates: removeDuplicates.value!,
        duplicatesThreshold: duplicatesThreshold.value
    })
    .then((params: CtrlParams) => {
        countDistances.value = params.countDistances as number ?? 0;
        endMessage.value = params.endMessage as string ?? "";
        pointsRemoved.value = params.pointsRemoved as number ?? -1;
    })
    .catch((error: Error) => showAlertMessage(`Error from distance computation: ${error.message}`,
                                              "fingerprints"));
});

/** On changing remove duplicates parameters */
watch([removeDuplicates, duplicatesThreshold], () => {

  askNode(id, "duplicates", {
        removeDuplicates: removeDuplicates.value!,
        duplicatesThreshold: duplicatesThreshold.value
    })
    .then((params: CtrlParams) => {
        pointsRemoved.value = params.pointsRemoved as number ?? -1;
    })
    .catch((error: Error) => showAlertMessage(`Error from duplicates removal: ${error.message}`,
                                              "fingerprints"));
});

/** On changing grouping parameters */
watch([groupingMethod, groupingThreshold, addedMargin], () => {

    countGroups.value = 0;

    sendToNode(id, "group-params", {

        groupingMethod: groupingMethod.value,
        groupingThreshold: groupingThreshold.value,
        addedMargin: addedMargin.value,
    });
});

/**
 * Start grouping structures based on the distance
 */
const ClassifyStructures = (): void => {

    countGroups.value = 0;

    askNode(id, "group", {
        groupingMethod: groupingMethod.value,
        groupingThreshold: groupingThreshold.value,
        addedMargin: addedMargin.value
    })
    .then((params: CtrlParams) => {
        countGroups.value = params.countGroups as number ?? 0;
    })
    .catch((error: Error) => showAlertMessage(`Error from grouping structures: ${error.message}`,
                                              "fingerprints"))
    .finally(() => groupingBusy.value = false);
};

/** Enable input of K value */
const useMargin = computed(() => groupingMethods
                                        .value[groupingMethod.value]?.usingMargin ?? false);

/**
 * Adjust addedMargin to be an integer on blur or Enter key
 */
const adjInteger = (): void => {
    addedMargin.value = Math.floor(addedMargin.value);
};

/**
 * Open a secondary window showing the resulting scatterplot
 */
const showScatterplot = (): void => {
    sendToNode(id, "scatter");
};

/**
 * Open a secondary window showing the energy landscape
 */
const showEnergyLandscape = (): void => {
    sendToNode(id, "landscape");
};

/**
 * Open a secondary window showing charts related to fingerprinting
 */
 const showCharts = (): void => {
    sendToNode(id, "charts");
};

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title mt-n1">Accumulated structures</v-label>

  <v-row class="mt-0 mb-2 ml-0 mr-2">
    <v-label class="result-label">{{ `Structures loaded: ${countAccumulated}` }}</v-label>
    <v-spacer />
    <v-btn @click="resetAccumulator">Reset</v-btn>
  </v-row>

  <v-label class="separator-title">Filter structures</v-label>

  <v-switch v-model="enableEnergyFiltering" :disabled="!haveEnergies"
            label="Filter by energy" class="ml-2 mt-n2" />
  <v-switch v-model="thresholdFromMinimum" :disabled="!enableEnergyFiltering || !haveEnergies"
            label="Threshold from minimum energy" class="ml-2 mt-n2 mb-4" />
  <v-row>
    <v-number-input v-model="energyThreshold" :disabled="!enableEnergyFiltering || !haveEnergies"
                    :label="thresholdFromMinimum ? 'Energy from minimum' : 'Max energy'" :step="0.1"
                    :precision="4" class="ml-4 mr-2" />
    <v-number-input v-model="energyThresholdEffective" control-variant="hidden"
                    label="Max energy" readonly :precision="4" class="ml-2 mr-5" />
  </v-row>

  <v-label class="mt-2 mb-2 result-label"> {{ accumulatedLabel }}</v-label>

  <v-label class="separator-title">Compute fingerprints</v-label>

  <v-switch v-model="areNanoclusters"
            label="Structures are nanoclusters" class="ml-2 mt-n1" />
  <v-row class="mt-0 mx-0">
    <v-switch v-model="forceCutoff" label="Force cutoff at:" class="ml-2 mb-6" />
    <v-number-input v-model="manualCutoffDistance" label="Cutoff distance"
                    :min="0.1" :step="0.1" :precision="2"
                    :disabled="!forceCutoff" class="mx-2" />
  </v-row>

  <v-label class="mt-1 mb-4 result-label">{{ cutoffLabel }}</v-label>

  <v-select v-model="fingerprintingMethod"
    :items="fingerprintMethodsNames"
    label="Fingerprinting method"
    item-title="label"
    item-value="value"
    class="mr-2 mb-6" />

  <v-row class="mr-2">
    <v-number-input v-model="peakWidth" :precision="2"
                    label="Peak width" :min="0.01" :step="0.01" class="mr-2 ml-2" />
    <v-number-input v-model="binSize" :precision="2"
                    label="Bin size" :min="0.01" :step="0.01" />
  </v-row>
  <v-btn block :disabled="countSelected === 0"
         @click="fingerprintingBusy=true; resultDimensionality=0; computeFingerprints()">
    Compute fingerprints & distances
  </v-btn>
  <v-label v-if="resultDimensionality > 0" class="mt-4 mb-2 result-label">
    {{ `Fingerprint dimension: ${resultDimensionality}` }}</v-label>
  <v-label v-if="fingerprintingBusy" class="mt-4 mb-2 result-label">Working&hellip;</v-label>

  <v-label class="separator-title">Compute distances</v-label>

  <v-select v-model="distanceMethod"
    label="Distance method"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    class="mr-2 mb-4" />

  <v-switch v-model="fixTriangleInequality"
            label="Fix triangle inequality" class="ml-2 mt-n1" />
  <v-row v-if="countDistances > 0" class="mt-n1 mb-n2">
    <v-col cols="12">
      <v-label class="result-label">
        {{ `Distances computed: ${countDistances}` }}
      </v-label>
    </v-col>
      <v-col cols="12" v-if="endMessage !== '' && fixTriangleInequality" class="mt-n4">
        <v-label class="result-label">
          {{ endMessage }}
        </v-label>
    </v-col>
  </v-row>

  <v-label class="separator-title">Remove duplicates</v-label>

  <v-row class="ml-0 mr-2 pt-3">
    <v-switch v-model="removeDuplicates"
            label="Remove" class="ml-2 mr-6 mb-5" />
    <v-number-input :disabled="!removeDuplicates" v-model="duplicatesThreshold"
            label="Distance threshold" :min="0" :max="1" :step="0.01" :precision="2" class="mt-0"/>
  </v-row>
  <v-label v-if="pointsRemoved >= 0 && removeDuplicates" class="result-label mt-2">
    {{ `Points removed: ${pointsRemoved} of ${countSelected}` }}
  </v-label>

  <v-label class="separator-title">Group similar</v-label>

  <v-select v-model="groupingMethod"
    :items="groupingMethods"
    label="Grouping method"
    item-title="label"
    item-value="value"
    class="mr-2 mb-4" />

  <v-row class="ml-0 mr-2 pt-1">
    <v-number-input v-model="groupingThreshold"
                    label="Distance thresh." :precision="2"
                    :min="0" :max="1" :step="0.01" />
    <v-number-input v-if="useMargin" v-model="addedMargin" :precision="0"
                    label="Margin" :min="0" :step="1" class="ml-2"
                    @blur="adjInteger" @keyup.enter="adjInteger" />
  </v-row>
  <v-btn block :disabled="countDistances === 0"
         @click="groupingBusy = true; ClassifyStructures()">
    Group similar structures
  </v-btn>
  <v-container class="pa-0">
    <v-label v-if="countGroups > 0" class="mt-4 mb-2 result-label">
      {{ `Found ${countGroups} groups` }}
    </v-label>
    <v-label v-if="groupingBusy" class="mt-4 mb-2 result-label">Working&hellip;</v-label>
  </v-container>

  <v-label class="separator-title">Show results</v-label>

  <v-btn block class="mb-2"
         :disabled="countDistances === 0" @click="showScatterplot">
    Show scatterplot
  </v-btn>
  <v-btn block class="mb-2"
         :disabled="!resultDimensionality" @click="showCharts">
    Show charts
  </v-btn>
  <v-btn block class="mb-6"
         :disabled="countDistances === 0 || !haveEnergies" @click="showEnergyLandscape">
    Show energy landscape
  </v-btn>

  <g-error-alert kind="fingerprints" />
</v-container>
</template>
