<script setup lang="ts">
/**
 * @component
 * Controls for variable composition analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {ref, toRaw, watch, reactive, computed, onUnmounted} from "vue";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import {storeToRefs} from "pinia";
import NodeAlert from "@/widgets/NodeAlert.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/**
 * Grouping results received from the main process
 * @notExported
 */
interface Recipe {
    /** Quantity of each component */
	key: string;
    /** Number of structures with the given composition */
	count: number;
    /** Result after analysis */
    valid?: string;
}

/**
 * Type of the list of fingerprinting methods names for selection
 * @notExported
 */
interface FPmethodName {
    /** Index of the method */
    value: number;
    /** Name of the method */
    label: string;
}

/**
 * Type of the list of distance methods names for selection
 * @notExported
 */
interface DistanceMethodsNames {
    /** Index of the method */
    value: number;
    /** Name of the method */
    label: string;
}

// > Mark compositions
const countAccumulated = ref(0);
const species = ref<string[]>([]);
const countComponents = ref(2);
const count = ref<number[]>([0]);
const results = ref<Recipe[]>([]);
const hasEnergies = ref(false);
const summary = ref<[number, number]>([0, 0]);

/** Selected table entries */
const selected = ref<string[]>([]);

// > Compute
const fingerprintMethodsNames = reactive<FPmethodName[]>([]);
const distanceMethods = reactive<DistanceMethodsNames[]>([]);
const analysisRunning = ref(false);
const analysisDone = ref(false);
const savedFiles = ref(-1);
const remainingAfterFilter = ref(0);

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasVariableComposition = true;
const {variableCompositionAccumulate} = storeToRefs(controlStore);

// > Persistent state that is saved in the project file
const state = reactive({
    filterOnDistance: true,
    distanceFromHull: 0.15,
    forceCutoff: true,
    manualCutoffDistance: 10,
    fingerprintingMethod: 0,
    binSize: 0.05,
    peakWidth: 0.02,
    distanceMethod: 0,
    fixTriangleInequality: false,
    removeDuplicates: true,
    duplicatesThreshold: 0.03,
    consolidateOutput: false
});

/** Pass state changes to the main process for saving in the project file */
const stopWatcher1 = watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

/** Update the components composition UI */
const stopWatcher2 = watch([species, countComponents], ([sp, cc]) => {

    const len = sp.length*cc;
    count.value.length = len;
    for(let i=0; i < len; ++i) count.value[i] = 0;
}, {deep: true, immediate: true});

/** Disable the compute compositions button */
const noComputeCompositions = computed(() => {

    // Disable if no structures
    if(countAccumulated.value === 0 || !hasEnergies.value) return true;

    // Disabled if any component has no atom defined
    const ns = species.value.length;
    const nc = countComponents.value;
    for(let i=0; i < nc; ++i) {
        let n = 0;
        for(let j=0; j < ns; ++j) n += count.value[i*ns+j];
        if(n === 0) return true;
    }

    // Disabled if any specie is not represented in any component
    for(let j=0; j < ns; ++j) {
        let n = 0;
        for(let i=0; i < nc; ++i) n += count.value[i*ns+j];
        if(n === 0) return true;
    }
    return false;
});

// > Initialize the ui
resetNodeAlert();
askNode(id, "init")
    .then((params) => {

        countAccumulated.value = params.countAccumulated as number ?? 0;
        species.value.length = 0;
        const speciesRaw = params.species as string[] ?? [];
        for(const s of speciesRaw) species.value.push(s);

        const fingerprintMethodsRaw = params.fingerprintMethods as string[] ?? [];
        let len = fingerprintMethodsRaw.length;
        fingerprintMethodsNames.length = 0;
        for(let i=0; i < len; ++i) {
            fingerprintMethodsNames.push({value: i, label: fingerprintMethodsRaw[i]});
        }

        const distanceMethodsRaw = params.distanceMethods as string[] ?? [];
        len = distanceMethodsRaw.length;
        distanceMethods.length = 0;
        for(let i=0; i < len; ++i) {
            distanceMethods.push({value: i, label: distanceMethodsRaw[i]});
        }

   	    state.filterOnDistance = params.filterOnDistance as boolean ?? true;
    	state.distanceFromHull = params.distanceFromHull as number ?? 0.15;
        state.forceCutoff = params.forceCutoff as boolean ?? true;
        state.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
        state.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
        state.binSize = params.binSize as number ?? 0.05;
        state.peakWidth = params.peakWidth as number ?? 0.02;
        state.distanceMethod = params.distanceMethod as number ?? 0;
        state.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
        state.removeDuplicates = params.removeDuplicates as boolean ?? true;
        state.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.03;
        state.consolidateOutput = params.consolidateOutput as boolean ?? false;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                      "variableComposition");
    });

/** Receive the parameters of the structures loaded */
receiveFromNode(id, "load", (params) => {

    countAccumulated.value = params.countAccumulated as number ?? 0;
    species.value.length = 0;
    for(const s of params.species as string[] ?? []) species.value.push(s);
    hasEnergies.value = params.hasEnergies as boolean ?? false;
    if(!hasEnergies.value) countAccumulated.value = 0;
});

/** Accumulation enabled in the reader */
const stopWatcher3 = watch(variableCompositionAccumulate, () => {

    askNode(id, "capture", {
        enableAnalysis: controlStore.variableCompositionAccumulate
    })
    .then((params) => {
        const speciesRaw = params.species as string[] ?? [];
        species.value.length = 0;
        for(const s of speciesRaw) species.value.push(s);
        countAccumulated.value = params.countAccumulated as number ?? 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from toggle capture for ${label}: ${error.message}`,
                      "variableComposition");
    });
});

/**
 * Reset the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
    countAccumulated.value = 0;
    results.value.length = 0;
    savedFiles.value = -1;
    resetNodeAlert();
    analysisDone.value = false;
    summary.value[0] = 0;
    summary.value[1] = 0;
};

/**
 * Compute compositions
 */
const computeCompositions = (): void => {

    resetNodeAlert();

    askNode(id, "compositions", {
        componentsCount: countComponents.value,
        components: toRaw(count.value)
    })
    .then((params) => {

        const recipes = JSON.parse(params.recipes as string ?? "[]") as Recipe[];
        summary.value[0] = 0;
        summary.value[1] = 0;
        results.value.length = 0;
        selected.value.length = 0;
        for(const recipe of recipes) {
            recipe.valid = "";
            results.value.push(recipe);
            selected.value.push(recipe.key);
        }
        remainingAfterFilter.value = params.remaining as number ?? 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from variable composition: ${error.message}`,
                      "variableComposition");
    });
};

type Align = "center" | "start" | "end";
const alignEnd = "end" as Align;

/** Headers for the results table */
const headers = ref([
    {key: "key",   title: "Composition", sortable: false, maxWidth: 13},
    {key: "count", title: "Count",       align: alignEnd, maxWidth: 5},
    {key: "valid", title: "Remain",      align: alignEnd, maxWidth: 5}
]);

/**
 * Do the variable composition analysis on the selected entries
 */
const analyzeSelected = async (): Promise<void> => {

    // Initialize interface
    for(const r of results.value) r.valid = "";
    summary.value[0] = 0; // Total
    summary.value[1] = 0; // Remaining

    // Initialize and validate the analysis parameters
    const sts = await askNode(id, "start", toRaw(state));
    if(sts.error) {
        analysisRunning.value = false;
        analysisDone.value = false;
        showNodeAlert(`Error starting variable composition results analysis: ${sts.error as string}`,
                      "variableComposition");
        return;
    }

    // Sort selected entries by increasing composition size
    const compositions = results.value
                                .filter((entry) => selected.value.includes(entry.key))
                                .toSorted((a, b) => a.count - b.count)
                                .map((entry) => entry.key);

    // Analyze the simple ones
    // Returns:
    //  compositionsReduced: string[]   // Not simple compositions to analyze
    //  resultsKeys: string[]           // Key to set on the screen
    //  resultsValid: string[]          // Corresponding remaining value
    //  summary: number[]               // Total and Remaining to set summary
    const remaining = await askNode(id, "analyze-simple", {compositions});
    if(remaining.error) {
        analysisRunning.value = false;
        analysisDone.value = false;
        showNodeAlert(`Error analyzing simple compositions: ${sts.error as string}`,
                      "variableComposition");
        return;
    }
    summary.value[0] = (remaining.summary as number[])[0]; // Total
    summary.value[1] = (remaining.summary as number[])[1]; // Remaining

    const len = (remaining.resultsKeys as string[]).length;
    for(let i=0; i < len; ++i) {

        const composition = (remaining.resultsKeys as string[])[i];
        for(const r of results.value) {
            if(r.key === composition) {
                r.valid = (remaining.resultsValid as string[])[i];
                break;
            }
        }
    }

    for(const composition of (remaining.compositionsReduced as string[])) {

        const key = composition.replaceAll("\u2009:\u2009", "-");
        const result = await askNode(id, "analyze", {key});

        if(result.error) {
            analysisRunning.value = false;
            analysisDone.value = false;
            showNodeAlert("Error analyzing variable composition results " +
                          `for key: "${result.key as string}": ${result.error as string}`,
                          "variableComposition");
            return;
        }

        for(const r of results.value) {
            if(r.key === composition) {
                const valid = result.valid as number;
                r.valid = valid.toFixed(0);
                break;
            }
        }

        summary.value[0] += result.total as number;
        summary.value[1] += result.valid as number;
    }

    analysisRunning.value = false;
    analysisDone.value = true;
};

/**
 * Save analysis results as files in the given directory
 */
const saveAnalyzed = (): void => {

    askNode(id, "save", {
        selected: toRaw(selected.value),
        countComponents: countComponents.value
    })
    .then((params) => {
        if(params.error) throw Error(params.error as string);
        savedFiles.value = params.saved as number ?? -1;
    })
    .catch((error: Error) => {
        savedFiles.value = -1;
        showNodeAlert(`Error saving variable composition results: ${error.message}`,
                        "variableComposition2");
    });
};

const disableSave = computed(() => {

    return (!analysisDone.value && state.removeDuplicates) || selected.value.length === 0;
});

const disableCharts = computed(() => {

    return !hasEnergies.value || countComponents.value > 3 ||
            (!analysisDone.value && state.removeDuplicates) ||
            selected.value.length === 0;
});
const disable3DView = computed(() => {

    return !hasEnergies.value || countComponents.value < 3 ||
            (!analysisDone.value && state.removeDuplicates) ||
            selected.value.length === 0;
});

/**
 * Open the convex hull secondary window
 */
const showCharts = (): void => {

    askNode(id, "convex-hull", {
        showChart: true,
        dimension: countComponents.value
    })
    .then((result) => {
        if(result.error) throw Error(result.error as string);
    })
    .catch((error: Error) => {
        showNodeAlert(`Convex hull computation error: ${error.message}`,
                      "variableComposition2");
    });
};

/**
 * Open the convex hull 3D view in a secondary window
 */
const show3DView = (): void => {

    askNode(id, "convex-hull-3d", {
        show3DView: true,
        dimension: countComponents.value
    })
    .then((result) => {
        if(result.error) throw Error(result.error as string);
    })
    .catch((error: Error) => {
        showNodeAlert(`3D convex hull computation error: ${error.message}`,
                      "variableComposition2");
    });
};

let lastFilterOnDistance: boolean;
let lastDistanceFromHull: number;
const stopWatcher4 = watch([state, selected], ([st, sel], [_ost, osel]) => {

    if(st.filterOnDistance !== lastFilterOnDistance ||
       st.distanceFromHull !== lastDistanceFromHull ||
       sel.length !== osel.length) {
        lastFilterOnDistance = st.filterOnDistance;
        lastDistanceFromHull = st.distanceFromHull;
        askNode(id, "filter", {
            filterOnDistance: st.filterOnDistance,
            distanceFromHull: st.distanceFromHull,
            selected: toRaw(selected.value)
        })
        .then((response) => {

            remainingAfterFilter.value = response.remaining as number ?? 0;
            summary.value[0] = 0;
            summary.value[1] = 0;
        })
        .catch((error: Error) => {
            showNodeAlert(`Filter structures error: ${error.message}`,
                          "variableComposition");
        });
    }
});

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
    stopWatcher3();
    stopWatcher4();
});

// Simplify label for the result of removing duplicates
const summaryLabel = computed(() =>
    (summary.value[0] > 0 ?
        `Removed ${summary.value[0]-summary.value[1]} of ${summary.value[0]}` :
        " ")
);

</script>


<template>
<v-container class="container pb-8">
  <v-label class="separator-title first-title">Accumulated structures</v-label>

  <v-row>
    <v-col cols="7">
      <v-label class="result-label pt-2">{{ `Count: ${countAccumulated}` }}</v-label>
    </v-col>
    <v-col>
      <v-btn :disabled="countAccumulated===0" class="w-100" @click="resetAccumulator">Reset</v-btn>
    </v-col>
  </v-row>

  <titled-slot title="Number of components" class="mt-4 mb-2">
    <v-btn-toggle v-model="countComponents" mandatory :disabled="countAccumulated === 0">
      <v-btn :value="2">2</v-btn>
      <v-btn :value="3">3</v-btn>
      <v-btn :value="4">4</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <div v-show="countAccumulated > 0">
    <v-label class="mb-2 mt-2">End-member compositions</v-label>
    <table class="collapse">
      <thead>
        <tr>
          <th></th>
          <th v-for="value of species" :key="value">{{ value }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in countComponents" :key="n">
          <td class="pb-5 pr-1">{{ n }}</td>
          <td v-for="(value, idx) of species" :key="value">
            <v-number-input v-model="count[idx+(n-1)*species.length]"
                            :step="1" :min="0" :max="999" class="ml-1" />
          </td>
        </tr>
      </tbody>
    </table>

    <block-button label="Compute compositions" :disabled="noComputeCompositions"
           @click="savedFiles=-1; analysisDone=false; computeCompositions()"/>
  </div>

  <node-alert node="variableComposition" class="mt-1"/>

  <v-label class="separator-title">Compositions</v-label>

  <v-data-table v-if="results.length > 0" v-model="selected" :items="results"
                class="pr-2" density="compact" select-strategy="all" items-per-page="-1"
                fixed-header hover height="250px" show-select item-value="key"
                hide-default-footer :headers hide-no-data />

  <v-label class="separator-title">Filter structures</v-label>

  <v-row class="pt-1 mb-n4">
    <v-switch v-model="state.filterOnDistance"
            label="Filter" class="ml-1 mr-2 mb-6" />
    <v-number-input v-model="state.distanceFromHull" :disabled="!state.filterOnDistance"
            label="Convex hull dist." :min="0" :max="1" :step="0.005"
            :precision="3" class="mt-0 mr-1 w-33"/>
    <v-number-input v-model="remainingAfterFilter" label="Remaining"
            readonly control-variant="hidden"/>
  </v-row>

  <v-label class="separator-title">Compute distances</v-label>

  <v-row class="ma-0 mb-n2">
    <v-switch v-model="state.forceCutoff" label="Force cutoff at:" class="ml-1 mb-6" />
    <v-number-input v-model="state.manualCutoffDistance" label="Cutoff distance"
                    :min="0.1" :step="0.1" :precision="2"
                    :disabled="!state.forceCutoff" class="ml-4" />
  </v-row>

  <v-select v-model="state.fingerprintingMethod"
    :items="fingerprintMethodsNames"
    label="Fingerprinting method"
    item-title="label"
    item-value="value"
    class="mb-4" />

  <v-row>
    <v-number-input v-model="state.peakWidth" :precision="2"
                    label="Peak width" :min="0" :step="0.01" class="mr-2" />
    <v-number-input v-model="state.binSize" :precision="2"
                    label="Bin size" :min="0.01" :step="0.01" />
  </v-row>

  <v-select v-model="state.distanceMethod"
    label="Distance method"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    class="mb-4 mt-n1" />

  <v-switch v-model="state.fixTriangleInequality"
            label="Fix triangle inequality" class="ml-1 mt-n1" />

  <v-label class="separator-title">Remove duplicates</v-label>

  <v-row class="pt-1 mb-n2">
    <v-switch v-model="state.removeDuplicates"
              label="Remove" class="ml-1 mr-6 mb-5" />
    <v-number-input v-model="state.duplicatesThreshold" :disabled="!state.removeDuplicates"
            label="Distance threshold" :min="0" :max="1" :step="0.005" :precision="3" class="mt-0"/>
  </v-row>
  <v-label class="result-label ml-1">{{ summaryLabel }}</v-label>
  <block-button :disabled="selected.length === 0 || !state.removeDuplicates || analysisRunning"
                :loading="analysisRunning"
                label="Analyze selected for duplicates" class="mb-n2 mt-2"
                @click="analysisRunning=true; savedFiles=-1; analyzeSelected()"/>
  <node-alert node="variableComposition2" class="mt-1"/>

  <block-button class="mt-2" :disabled="disableCharts" label="Show chart" @click="showCharts" />
  <block-button :disabled="disable3DView" label="3D view" @click="show3DView" />
  <v-switch v-model="state.consolidateOutput" :disabled="disableSave"
            label="Consolidate output" class="ml-1 mt-n2"/>
  <block-button class="mt-2" :disabled="disableSave" label="Save analyzed" @click="saveAnalyzed" />
  <v-label v-if="savedFiles >= 0" class="result-label pt-4 ml-1">
    {{ `Files saved: ${savedFiles}` }}
  </v-label>
</v-container>
</template>
