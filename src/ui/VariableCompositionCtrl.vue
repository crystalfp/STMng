<script setup lang="ts">
/**
 * @component
 * Controls for variable composition analysis
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
 */
import {ref, toRaw, watch} from "vue";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import NodeAlert from "@/widgets/NodeAlert.vue";
import {useControlStore} from "@/stores/controlStore";
import {storeToRefs} from "pinia";

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

const countAccumulated = ref(0);
const species = ref<string[]>([]);
const countComponents = ref(2);
const count = ref<number[]>([0]);
const results = ref<Recipe[]>([]);
const selectedGroup = ref("");

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasVariableComposition = true;
const {variableCompositionAccumulate} = storeToRefs(controlStore);

/** Update the components composition UI */
watch([species, countComponents], ([sp, cc]) => {

    const len = sp.length*cc;
    count.value.length = len;
    for(let i=0; i < len; ++i) count.value[i] = 0;
}, {deep: true, immediate: true});

// > Initialize the ui
resetNodeAlert();
askNode(id, "init").then((params) => {

    countAccumulated.value = params.countAccumulated as number ?? 0;
    species.value.length = 0;
    const speciesRaw = params.species as string[] ?? [];
    for(const s of speciesRaw) species.value.push(s);
})
.catch((error: Error) => {
    showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                  "variableComposition");
});

/** Receive the parameters of structures loaded */
receiveFromNode(id, "load", (params) => {

    countAccumulated.value = params.countAccumulated as number ?? 0;
    species.value.length = 0;
    for(const s of params.species as string[] ?? []) species.value.push(s);
});

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
    selectedGroup.value = "";
};

/**
 * Compute grouping
 */
const computeGroups = (): void => {

    // Check all components are valid
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

/**
 * Select a line in the composition tables
 *
 * @param idx - Index of the selected line
 */
const selectedResult = (idx: number): void => {

    selectedGroup.value = results.value[idx].key;
    // TBD Here something should be done
};

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title">Accumulated structures</v-label>

  <v-row class="mx-0">
    <v-col cols="7">
      <v-label class="result-label pt-1">{{ `Structures analyzed: ${countAccumulated}` }}</v-label>
    </v-col>
    <v-col>
      <v-btn :disabled="countAccumulated===0" class="w-100" @click="resetAccumulator">Reset</v-btn>
    </v-col>
  </v-row>

  <v-number-input v-model="countComponents" :disabled="countAccumulated === 0"
                  label="Number of components" :step="1" :min="2" :max="4"
                  class="ml-2 mr-3 mt-4" />

  <table class="ml-2">
    <tbody>
      <tr v-for="(value, idx) of species" :key="value">
        <td class="pb-4">{{ value }}</td>
        <td v-for="n in countComponents" :key="n">
          <v-number-input v-model="count[idx+(n-1)*species.length]"
                  :step="1" :min="0" :max="999"
                  class="ml-1" />
        </td>
      </tr>
    </tbody>
  </table>

  <v-btn class="w-100 mb-2" :disabled="countAccumulated === 0"
         @click="computeGroups">Compute compositions</v-btn>

  <v-label class="separator-title">Compositions</v-label>
  <v-table v-if="results.length > 0" class="ml-2" hover fixed-header height="300px">
    <thead>
      <tr>
        <th class="w-50">Composition</th>
        <th class="w-50">Count</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(value, idx) of results" :key="value.key" @click="selectedResult(idx)">
        <td>{{ value.key }}</td>
        <td>{{ value.count }}</td>
      </tr>
    </tbody>
  </v-table>
  <v-label v-if="selectedGroup !== ''" class="mt-4 mb-4 ml-2 result-label">
    {{ `Selected group ${selectedGroup}` }}
  </v-label>

  <node-alert node="variableComposition" />

</v-container>
</template>
