<script setup lang="ts">
/**
 * @component
 * Controls for structure sets analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-24
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {ref, toRaw, watch, reactive, computed, onUnmounted} from "vue";
import {storeToRefs} from "pinia";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import {theme} from "@/services/ReceiveTheme";

import type {DistanceMethodsNames, FPmethodName} from "@/types";
import type {VariableTransitionTable} from "@/electron/analysis/EnthalpyTransitionsVariable";

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

// > Mark compositions
const countAccumulated = ref(0);
const species = ref<string[]>([]);
const countComponents = ref(2);
const count = ref([0]);
const results = ref<Recipe[]>([]);
const summary = ref<[total: number, remaining: number]>([0, 0]);
const compositionRunning = ref(false);
const numberCompositions = ref(0);

// > Compute
const fingerprintMethodsNames = reactive<FPmethodName[]>([]);
const distanceMethods = reactive<DistanceMethodsNames[]>([]);
const analysisRunning = ref(false);
const analysisDone = ref(false);
const savedFiles = ref(-1);
const remainingAfterFilter = ref(0);

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasAnalyzeStructureSets = true;
const {analyzeStructureSetsAccumulate} = storeToRefs(controlStore);

// > Persistent state that is saved in the project file
const state = reactive({
    numberComponents: 2,
    filterStructures: true,
    distanceFromHull: 0.15,
    energyFromMinimum: 0.1,
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

/** Update the components composition UI */
const stopWatcher2 = watch([species, countComponents], ([sp, cc]) => {

    const len = sp.length*cc;
    count.value.length = len;
    for(let i=0; i < len; ++i) count.value[i] = 0;

    if(cc === 1) {
        askNode(id, "filter", {
            numberComponents: cc,
            filterStructures: state.filterStructures,
            distanceFromHull: state.distanceFromHull,
            energyFromMinimum: state.energyFromMinimum
        })
        .then((response) => {

            remainingAfterFilter.value = response.remaining as number ?? 0;
            summary.value[0] = 0;
            summary.value[1] = 0;
        })
        .catch((error: Error) => {
            showNodeAlert(`Filter structures error: ${error.message}`,
                          "analyzeStructureSets");
        });
    }
}, {deep: true, immediate: true});

/** Disable the compute compositions button */
const noComputeCompositions = computed(() => {

    // Disable if no structures
    if(countAccumulated.value === 0) return true;

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

        countComponents.value = params.numberComponents as number ?? 2;

        state.filterStructures = params.filterStructures as boolean ?? true;
        state.distanceFromHull = params.distanceFromHull as number ?? 0.15;
        state.energyFromMinimum = params.energyFromMinimum as number ?? 0.1;
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
                      "analyzeStructureSets");
    });

/** Receive the parameters of the structures loaded */
receiveFromNode(id, "load", (params) => {

    countAccumulated.value = params.countAccumulated as number ?? 0;
    species.value.length = 0;
    const speciesRaw = params.species as string[] ?? [];
    for(const s of speciesRaw) species.value.push(s);
    remainingAfterFilter.value = params.countRemaining as number ?? 0;
});

/** Accumulation enabled in the reader */
const stopWatcher3 = watch(analyzeStructureSetsAccumulate, () => {

    askNode(id, "capture", {
        enableAnalysis: controlStore.analyzeStructureSetsAccumulate
    })
    .then((params) => {
        const speciesRaw = params.species as string[] ?? [];
        species.value.length = 0;
        for(const s of speciesRaw) species.value.push(s);
        countAccumulated.value = params.countAccumulated as number ?? 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from toggle capture for ${label}: ${error.message}`,
                      "analyzeStructureSets");
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
    table.value.length = 0;
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

        summary.value[0] = 0;
        summary.value[1] = 0;
        remainingAfterFilter.value = params.remaining as number ?? 0;
        results.value.length = 0;
        const recipesRaw = params.recipes as string;
        if(!recipesRaw) return;
        const recipes = JSON.parse(recipesRaw) as Recipe[];
        for(const recipe of recipes) {
            recipe.valid = "";
            results.value.push(recipe);
        }
        numberCompositions.value = recipes.length;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from variable composition: ${error.message}`,
                      "analyzeStructureSets");
    })
    .finally(() => compositionRunning.value = false);
};

/**
 * Do the variable composition analysis on the selected entries
 */
const analyzeSelected = async (): Promise<void> => {

    // Initialize interface
    summary.value[0] = 0; // Total
    summary.value[1] = 0; // Remaining

    // Initialize and validate the analysis parameters
    const sts = await askNode(id, "start", toRaw(state));
    if(sts.error) {
        analysisRunning.value = false;
        analysisDone.value = false;
        showNodeAlert(`Error starting variable composition results analysis: ${sts.error as string}`,
                      "analyzeStructureSets");
        return;
    }

    if(countComponents.value === 1) {
        results.value.length = 0;
        results.value.push({
            count: sts.countEnabled as number ?? 0,
            key: "1"
        });
    }

    // Sort selected entries by increasing composition size
    const compositions = results.value
                                .toSorted((a, b) => a.count - b.count)
                                .map((entry) => entry.key);

    // Analyze the simple ones
    const remaining = await askNode(id, "analyze-simple", {compositions});
    if(remaining.error) {
        analysisRunning.value = false;
        analysisDone.value = false;
        showNodeAlert(`Error analyzing simple compositions: ${sts.error as string}`,
                      "analyzeStructureSets");
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

        const key = composition.replaceAll("\u{2009}:\u{2009}", "-");
        const result = await askNode(id, "analyze", {key});

        if(result.error) {
            analysisRunning.value = false;
            analysisDone.value = false;
            showNodeAlert("Error analyzing variable composition results " +
                          `for key: "${result.key as string}": ${result.error as string}`,
                          "analyzeStructureSets");
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
        countComponents: countComponents.value
    })
    .then((params) => {
        if(params.error) throw Error(params.error as string);
        savedFiles.value = params.saved as number ?? -1;
    })
    .catch((error: Error) => {
        savedFiles.value = -1;
        showNodeAlert(`Error saving variable composition results: ${error.message}`,
                        "analyzeStructureSets");
    });
};

/** Various disabler */
const disableOnNoAnalysisDone = computed(() => {

    return countAccumulated.value === 0 ||
            (!analysisDone.value && state.removeDuplicates);
});

const disableCharts = computed(() => {

    return countComponents.value > 3 ||
            countAccumulated.value === 0 ||
            (!analysisDone.value && state.removeDuplicates);
});

const disable3DView = computed(() => {

    return countComponents.value < 3 ||
            countAccumulated.value === 0 ||
            (!analysisDone.value && state.removeDuplicates);
});

/**
 * Open the convex hull secondary window
 */
const showCharts = (): void => {

    if(countComponents.value === 1) {
        sendToNode(id, "ev-chart");
    }
    else {
        askNode(id, "convex-hull", {
            dimension: countComponents.value
        })
        .then((result) => {
            if(result.error) throw Error(result.error as string);
        })
        .catch((error: Error) => {
            showNodeAlert(`Convex hull computation error: ${error.message}`,
                        "analyzeStructureSets");
        });
    }
};

/**
 * Open the convex hull 3D view in a secondary window
 */
const show3DView = (): void => {

    askNode(id, "convex-hull-3d", {
        dimension: countComponents.value
    })
    .then((result) => {
        if(result.error) throw Error(result.error as string);
    })
    .catch((error: Error) => {
        showNodeAlert(`3D convex hull computation error: ${error.message}`,
                      "analyzeStructureSets");
    });
};

/** Change filtering parameters */
let lastFilterStructures = true;
let lastDistanceFromHull = 0;
let lastEnergyFromMinimum = 0;
const stopWatcher4 = watch(state, (st) => {

    // Pass state changes to the main process for saving in the project file
    sendToNode(id, "state", toRaw(st));

    if(st.filterStructures !== lastFilterStructures ||
       st.distanceFromHull !== lastDistanceFromHull ||
       st.energyFromMinimum !== lastEnergyFromMinimum) {

        lastFilterStructures = st.filterStructures;
        lastDistanceFromHull = st.distanceFromHull;
        lastEnergyFromMinimum = st.energyFromMinimum;

        askNode(id, "filter", {
            numberComponents: countComponents.value,
            filterStructures: st.filterStructures,
            distanceFromHull: st.distanceFromHull,
            energyFromMinimum: st.energyFromMinimum
        })
        .then((response) => {

            remainingAfterFilter.value = response.remaining as number ?? 0;
            summary.value[0] = 0;
            summary.value[1] = 0;
        })
        .catch((error: Error) => {
            showNodeAlert(`Filter structures error: ${error.message}`,
                          "analyzeStructureSets");
        });
    }
}, {deep: true});

// Cleanup
onUnmounted(() => {
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

const compositionsLabel = computed(() => {
    if(countComponents.value === 1) return "Compositions: 1";
    if(countAccumulated.value === 0 || numberCompositions.value === 0) return  " ";
    return `Compositions: ${numberCompositions.value}`;
});

/** Result table entry */
interface TableEntry {
    /** Structure step */
    step: string;
    /** Corresponding formula */
    formula: string;
    /** Transition pressure */
    pressure: string;
}
const table = ref<TableEntry[]>([]);

/** Result table entry for variable composition */
interface TableVarEntry {
    /** An unique identifier for v-for key */
    id: number;
    /** Structure step */
    step: string;
    /** Corresponding formula */
    formula: string;
    /** Transition pressure */
    pressureRange: string;
    /** Enthalpy of formation */
    enthalpy: string;
}
const tableVar = ref<TableVarEntry[]>([]);
const tableVarRunning = ref(false);

/**
 * Compute enthalpy transitions
 */
const enthalpyTransition = (): void => {

    tableVarRunning.value = true;
    if(countComponents.value > 1) {
        askNode(id, "transitions-var")
        .then((response) => {

            tableVar.value.length = 0;
            const transitionRaw = response.transitions as string;
            if(!transitionRaw) throw Error("Empty transitions");
            const transitions = JSON.parse(transitionRaw) as VariableTransitionTable;
            const n = transitions.pressures.length;
            let idx = 0;
            for(let i=0; i < n; ++i) {
                const [pl, ph] = transitions.pressures[i];
                const range = `\u{2002}${pl.toFixed(1)}\u{2002}\u{27F7}\u{2002}${ph.toFixed(1)}`;
                tableVar.value.push({
                    id: idx++,
                    pressureRange: range,
                    step: "",
                    formula: "",
                    enthalpy: ""
                });
                const len = transitions.steps[i].length;
                for(let j=0; j < len; ++j) {
                    tableVar.value.push({
                        id: idx++,
                        pressureRange: "",
                        step: transitions.steps[i][j].toFixed(0),
                        formula: transitions.formulas[i][j],
                        enthalpy: transitions.enthalpies[i][j].toFixed(4)
                    });
                }
            }
        })
        .catch((error: Error) => {
            showNodeAlert(`Compute enthalpy transitions error: ${error.message}`,
                          "analyzeStructureSets");
        })
        .finally(() => tableVarRunning.value = false);
    }
    else {
        askNode(id, "transitions-fix")
        .then((response) => {

            const rawSteps = response.steps as number[] ?? [];
            const rawFormulas = response.formulas as string[] ?? [];
            const rawPressures = response.pressures as number[] ?? [];

            table.value.length = 0;
            for(let i=0; i < rawSteps.length; ++i) {
                table.value.push({
                    step: rawSteps[i].toFixed(0),
                    formula: rawFormulas[i],
                    pressure: rawPressures[i].toFixed(3)
                });
            }
        })
        .catch((error: Error) => {
            showNodeAlert(`Compute enthalpy transitions error: ${error.message}`,
                          "analyzeStructureSets");
        })
        .finally(() => tableVarRunning.value = false);
    }
};

const showTableVar = computed(() => {

    return tableVar.value.length > 0 &&
           countComponents.value > 1 &&
           countAccumulated.value > 0;
});

/**
 * Show the chart of the convex hull
 */
const saveStructures = (): void => {

    sendToNode(id, "save-transitions");
};

/**
 * Show the phase diagram
 */
const showPhaseDiagram = (): void => {

    sendToNode(id, "phase-diagram", {
        numberComponents: countComponents.value,
        atomTypes: toRaw(species.value),
        atomCounts: toRaw(count.value)
    });
};

const alignEnd = "end" as "center" | "start" | "end";

/** Headers for the results table */
const headers = ref([
    {key: "step",     title: "Step",    maxWidth: "60px", align: alignEnd},
    {key: "formula",  title: "Formula", maxWidth: "90px"},
    {key: "pressure", title: "Pressure (GPa)", align: alignEnd, nowrap: true},
]);

// Workaround to non-working CSS light-dark() in production
const bck = computed(() => {
    return theme.value === "light" ? "#FFFFFF" : "#212121";
});
const border = computed(() => {
    return theme.value === "light" ? "#E0DCDF" : "#3C3C3C";
});

</script>


<template>
<v-container class="container pb-8">
  <v-label class="separator-title first-title">Accumulated structures</v-label>

  <v-row>
    <v-col cols="7">
      <v-label class="result-label pt-1">{{ `Count: ${countAccumulated}` }}</v-label>
    </v-col>
    <v-col>
      <v-btn :disabled="countAccumulated===0" class="w-100" @click="resetAccumulator">Reset</v-btn>
    </v-col>
  </v-row>

  <titled-slot title="Number of components" class="mt-4 mb-2">
    <v-btn-toggle v-model="countComponents" mandatory :disabled="countAccumulated === 0">
      <v-btn :value="1">1</v-btn>
      <v-btn :value="2">2</v-btn>
      <v-btn :value="3">3</v-btn>
      <v-btn :value="4">4</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <div v-show="countAccumulated > 0 && countComponents > 1">
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

    <block-button label="Compute compositions" class="mb-n1"
                  :disabled="noComputeCompositions || compositionRunning"
                  :loading="compositionRunning"
           @click="savedFiles=-1; analysisDone=false; compositionRunning=true; computeCompositions()"/>
  </div>
  <v-label class="result-label ml-1 mt-1">{{ compositionsLabel }}</v-label>

  <node-alert node="analyzeStructureSets" class="mt-1"/>

  <v-label class="separator-title">Filter structures</v-label>

  <v-row class="pt-1 mb-n4">
    <v-switch v-model="state.filterStructures"
            label="Filter" class="ml-1 mr-2 mb-6" />
    <v-number-input v-if="countComponents === 1" v-model="state.energyFromMinimum"
            :disabled="!state.filterStructures"
            label="Energy from min." :min="0" :step="0.005"
            :precision="3" class="mt-0 mr-1 w-33"/>
    <v-number-input v-else v-model="state.distanceFromHull"
            :disabled="!state.filterStructures"
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
  <block-button :disabled="!state.removeDuplicates || analysisRunning"
                :loading="analysisRunning"
                label="Analyze selected for duplicates" class="mb-n2 mt-2"
                @click="analysisRunning=true; savedFiles=-1; analyzeSelected()"/>
  <node-alert node="analyzeStructureSets" class="mt-1"/>

  <v-label class="separator-title">Analyze results</v-label>

  <block-button class="mt-2" :disabled="disableCharts" label="Show chart" @click="showCharts" />
  <block-button :disabled="disable3DView" label="3D view" @click="show3DView" />
  <v-switch v-model="state.consolidateOutput" :disabled="disableOnNoAnalysisDone"
            label="Consolidate output" class="ml-1 mt-n2"/>
  <block-button class="mt-2 mb-n2" :disabled="disableOnNoAnalysisDone" label="Save analyzed" @click="saveAnalyzed" />
  <v-label v-if="savedFiles >= 0" class="result-label pt-4 ml-1 mt-2">
    {{ `Files saved: ${savedFiles}` }}
  </v-label>

  <v-label class="separator-title">Enthalpy transitions</v-label>

  <block-button :disabled="disableOnNoAnalysisDone" label="Compute transitions"
                :loading="tableVarRunning" @click="enthalpyTransition" />
  <v-data-table v-if="table.length > 0 && countComponents === 1" :items="table"
                class="pr-2" density="compact" select-strategy="all" items-per-page="-1"
                fixed-header hover height="300px"
                hide-default-footer :headers hide-no-data>
    <template #item.formula="{item}">
      <div v-html="item.formula"/>
    </template>
  </v-data-table>
  <div v-if="showTableVar" class="tc1">
    <table style="width:100%">
      <thead>
        <tr>
          <th class="tds1">Step</th>
          <th class="tde1">Enthalpy</th>
          <th class="tdf1">Formula</th>
        </tr>
      </thead>
    </table>
  </div>
  <div v-if="showTableVar" class="tc">
    <table style="width:100%">
      <tbody>
        <tr v-for="t of tableVar" :key="t.id" class="tr">
          <td v-if="t.step === ''" colspan="3" class="tdp">
              {{ `Pressure range (GPa): ${t.pressureRange}` }}</td>
          <td v-if="t.step !== ''" class="tds">{{ t.step }}</td>
          <td v-if="t.step !== ''" class="tde">{{ t.enthalpy }}</td>
          <td v-if="t.step !== ''" class="tdf" v-html="t.formula"></td>
        </tr>
      </tbody>
    </table>
  </div>
  <block-button class="mt-4 ml-1" label="Show phase diagram"
                :disabled="tableVar.length === 0" @click="showPhaseDiagram"/>
  <block-button class="ml-1" label="Save transition structures"
                :disabled="table.length === 0 && tableVar.length === 0" @click="saveStructures"/>
  <node-alert node="analyzeStructureSets2" class="mt-1"/>
</v-container>
</template>

<style scoped>
.tc1 {
  background-color: v-bind(bck);
  margin-right: -12px;
}

.tds1 {
  width: 40px;
  text-align: center;
}

.tde1 {
  width: 20px;
  text-align: center;
}

.tdf1 {
  width: 120px;
  text-align: left;
}

.tc {
  height: 300px;
  overflow-y: auto;
  background-color: v-bind(bck);
  margin-right: -12px;
}

.tr {
  line-height: 20px;
}

.tdp {
  border-top: 1px solid v-bind(border);
  width: 100%;
  padding-left: 5px;
  padding-top: 4px;
  color: #00C853 !important;
}

.tds {
  width: 40px;
  text-align: right;
}

.tde {
  width: 20px;
  text-align: right;
}

.tdf {
  width: 120px;
  padding-left: 20px;
}
</style>
