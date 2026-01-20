<script setup lang="ts">
/**
 * @component
 * Controls for variable composition analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
 */
import {ref, toRaw, watch, reactive} from "vue";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import {storeToRefs} from "pinia";
import NodeAlert from "@/widgets/NodeAlert.vue";

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

// > Compute
const fingerprintMethodsNames = reactive<FPmethodName[]>([]);
const distanceMethods = reactive<DistanceMethodsNames[]>([]);
const analysisRunning = ref(false);
const analysisDone = ref(false);
const savedFiles = ref(-1);

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasVariableComposition = true;
const {variableCompositionAccumulate} = storeToRefs(controlStore);

// > Persistent state that is saved in the project file
const state = reactive({
    forceCutoff: false,
    manualCutoffDistance: 10,
    fingerprintingMethod: 0,
    binSize: 0.05,
    peakWidth: 0.02,
    distanceMethod: 0,
    fixTriangleInequality: false,
    removeDuplicates: true,
    duplicatesThreshold: 0.015
});

/** Pass state changes to the main process for saving in the project file */
watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

/** Update the components composition UI */
watch([species, countComponents], ([sp, cc]) => {

    const len = sp.length*cc;
    count.value.length = len;
    for(let i=0; i < len; ++i) count.value[i] = 0;
}, {deep: true, immediate: true});

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

        state.forceCutoff = params.forceCutoff as boolean ?? false;
    	state.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
    	state.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
    	state.binSize = params.binSize as number ?? 0.05;
    	state.peakWidth = params.peakWidth as number ?? 0.02;
    	state.distanceMethod = params.distanceMethod as number ?? 0;
    	state.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
    	state.removeDuplicates = params.removeDuplicates as boolean ?? true;
    	state.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
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
});

/** Accumulation enabled in the reader */
watch(variableCompositionAccumulate, () => {

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
};

/**
 * Compute grouping
 */
const computeGroups = (): void => {

    resetNodeAlert();

    // Check if all components are valid
    for(let i=0; i < countComponents.value; ++i) {
        let allZeroes = true;
        for(let j=0; j < species.value.length; ++j) {
            if(count.value[i*species.value.length+j] !== 0) {
                allZeroes = false;
                break;
            }
        }
        if(allZeroes) {
            showNodeAlert(`Invalid content for component ${i+1}`,
                          "variableComposition");
            return;
        }
    }

    askNode(id, "group", {
        componentsCount: countComponents.value,
        components: toRaw(count.value)
    }).then((params) => {

        const recipes = JSON.parse(params.recipes as string ?? "[]") as Recipe[];
        results.value.length = 0;
        for(const recipe of recipes) results.value.push(recipe);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from variable composition: ${error.message}`,
                      "variableComposition");
    });
};

/** Headers for the results table */
const headers = [
  {key: "key",   title: "Composition", sortable: false},
  {key: "count", title: "Count"}
];

/** Selected table entries */
const selected = ref<string[]>([]);

/**
 * Do the variable composition analysis on the selected entries
 */
const analyzeSelected = (): void => {

    askNode(id, "start")
        .then(async () => {

            const promises = [];
            for(const composition of selected.value) {
                promises.push(askNode(id, "analyze", {key: composition.replace("\u2009:\u2009", "-")}));
            }
            return Promise.all(promises);
        })
        .then((allParams) => {

            for(const params of allParams) {
                if(params.error) throw Error(`For key: "${params.key as string}": ${params.error as string}`);
            }
            analysisDone.value = true;
        })
        .catch((error: Error) => {
            analysisDone.value = false;
            showNodeAlert(`Error analyzing variable composition results: ${error.message}`,
                          "variableComposition");
        });
};

/**
 * Save analysis results as files in the given directory
 */
const saveAnalyzed = (): void => {

    askNode(id, "save", {selected: toRaw(selected.value)})
        .then((params) => {
            if(params.error) throw Error(params.error as string);
            savedFiles.value = params.saved as number ?? -1;
        })
        .catch((error: Error) => {
            savedFiles.value = -1;
            showNodeAlert(`Error saving variable composition results: ${error.message}`,
                          "variableComposition");
        });
};

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title">Accumulated structures</v-label>

  <v-row class="mx-0">
    <v-col cols="7">
      <v-label class="result-label pt-1">{{ `Count: ${countAccumulated}` }}</v-label>
    </v-col>
    <v-col>
      <v-btn :disabled="countAccumulated===0" class="w-100" @click="resetAccumulator">Reset</v-btn>
    </v-col>
  </v-row>

  <v-number-input v-model="countComponents" :disabled="countAccumulated === 0"
                  label="Number of components" :step="1" :min="2" :max="4"
                  class="ml-2 mr-3 mt-4" />

  <div v-show="countAccumulated > 0">
    <v-label class="ml-2 mb-2">End-member compositions</v-label>
    <table class="ml-2">
      <tbody>
        <tr v-for="(value, idx) of species" :key="value">
          <td class="pb-4">{{ value }}</td>
          <td v-for="n in countComponents" :key="n">
            <v-number-input v-model="count[idx+(n-1)*species.length]"
                            :step="1" :min="0" :max="999" class="ml-1" />
          </td>
        </tr>
      </tbody>
    </table>

    <v-btn class="w-100 mb-2" :disabled="countAccumulated === 0"
           @click="computeGroups">Compute compositions</v-btn>
  </div>

  <node-alert node="variableComposition" />

  <v-label class="separator-title">Compositions</v-label>

  <v-data-table v-if="results.length > 0" v-model="selected" :items="results"
                class="ml-2" density="compact" select-strategy="all" items-per-page="-1"
                fixed-header hover height="300px" show-select item-value="key"
                hide-default-footer :headers hide-no-data />

  <v-label class="separator-title">Analysis</v-label>

  <v-row class="ma-0">
    <v-switch v-model="state.forceCutoff" label="Force cutoff at:" class="ml-2 mb-6" />
    <v-number-input v-model="state.manualCutoffDistance" label="Cutoff distance"
                    :min="0.1" :step="0.1" :precision="2"
                    :disabled="!state.forceCutoff" class="ml-4 mr-2" />
  </v-row>

  <v-select v-model="state.fingerprintingMethod"
    :items="fingerprintMethodsNames"
    label="Fingerprinting method"
    item-title="label"
    item-value="value"
    class="mx-2 mb-6" />

  <v-row class="ml-0 mr-2">
    <v-number-input v-model="state.peakWidth" :precision="2"
                    label="Peak width" :min="0" :step="0.01" class="mr-2 ml-2" />
    <v-number-input v-model="state.binSize" :precision="2"
                    label="Bin size" :min="0.01" :step="0.01" />
  </v-row>

  <v-select v-model="state.distanceMethod"
    label="Distance method"
    :items="distanceMethods"
    item-title="label"
    item-value="value"
    class="mx-2 mb-4" />

  <v-switch v-model="state.fixTriangleInequality"
            label="Fix triangle inequality" class="ml-2 mt-n1" />

  <v-row class="ml-0 mr-2 pt-5 pb-2">
    <v-switch v-model="state.removeDuplicates"
            label="Remove dupl." class="ml-2 mr-6 mb-5" />
    <v-number-input v-model="state.duplicatesThreshold" :disabled="!state.removeDuplicates"
            label="Distance threshold" :min="0" :max="1" :step="0.005" :precision="3" class="mt-0"/>
  </v-row>

  <v-btn block :disabled="selected.length === 0"
         @click="analysisRunning=true; analyzeSelected()">
    Analyze selected
  </v-btn>
 <v-btn block class="mt-4" :disabled="!analysisDone || selected.length === 0"
        @click="saveAnalyzed">
    Save analyzed
 </v-btn>
 <v-label v-if="savedFiles >= 0"
    class="result-label pt-4 ml-2 mb-6">{{ `Files saved: ${savedFiles}` }}</v-label>
</v-container>
</template>
