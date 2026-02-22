<script setup lang="ts">
/**
 * @component
 * Controls for the prototype and collection matchers node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
 */
import {ref, reactive, watch, toRaw} from "vue";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CollectionIndexEntry} from "@/electron/modules/CollectionDb";

import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Persistent state that is saved in the project file
const state = reactive({
    enabled: false,

    noThreshold: false,
    threshold: 0.01,
    numberMatches: 1,

    lengthTolerance: 0.2,
    siteTolerance: 0.3,
    angleTolerance: 5,
});

const showNumberMatches = ref(1);
const similar = reactive<CollectionIndexEntry[]>([]);

/**
 * Identifiers for the matched prototypes
 * @notExported
 */
type Prototype = [string, string];
const prototypes = reactive<Prototype[]>([]);
const formula = ref("");

/** Result selector is in the dead-time period */
let waiting = false;

// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {
        state.enabled = params.enableMatcher as boolean ?? false;
        state.noThreshold = params.noThreshold as boolean ?? false;
        state.numberMatches = params.numberMatches as number ?? 1;
        state.threshold = params.threshold as number ?? 0.01;
        state.lengthTolerance = params.lengthTolerance as number ?? 0.2;
        state.siteTolerance = params.siteTolerance as number ?? 0.3;
        state.angleTolerance = params.angleTolerance as number ?? 5;

        prototypes.length = 0;
        similar.length = 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for "${label}": ${error.message}`,
                      "matchers");
    });

/** Pass state changes to the main process for saving in the project file */
watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

/** Receive the parameters of the structures loaded */
receiveFromNode(id, "load-coll", (params) => {

    const ids = params.ids as string[] ?? [];
    const titles = params.titles as string[] ?? [];
    const distances = params.distances as number[] ?? [];
    const len = ids.length;
    similar.length = 0;
    for(let i=0; i < len; ++i) {
        similar.push({
            id: ids[i],
            title: titles[i],
            distance: distances[i]
        });
    }
});
receiveFromNode(id, "load-proto", (params) => {

    const aflow = params.aflow as string[] ?? [];
    const titles = params.titles as string[] ?? [];
    formula.value = params.formula as string ?? "";

    const len = aflow.length;
    prototypes.length = 0;
    for(let i=0; i < len; ++i) {
        prototypes.push([titles[i], aflow[i]]);
    }
});

/**
 * Display in a secondary window the corresponding structure
 *
 * @param IdOrAflow - Collection structure file ID or prototype Aflow UID
 * @param isCollection - True if the id comes from the collection results
 */
const selectResult = (IdOrAflow: string, isCollection: boolean): void => {

    if(!IdOrAflow || waiting) return;
    setTimeout(() => {waiting = false;}, 500);
    waiting = true;

    // Retrieve prototype
    askNode(id, "show", {id: IdOrAflow, isCollection})
        .then((result) => {
            if(result.error) throw Error(result.error as string);
        })
        .catch((error: Error) => {
            showNodeAlert(error.message, "matchers");
        });
};

/**
 * Reset parameters to default values
 */
const resetParams = (): void => {

    Object.assign(state, {
        lengthTolerance: 0.2,
        siteTolerance: 0.3,
        angleTolerance: 5,
        noThreshold: false,
        threshold: 0.01,
        numberMatches: 1,
    });
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="state.enabled" label="Enable matchers" class="mt-6 ml-1" />
  <v-label v-if="formula !== ''" class="mt-2 pb-1 ml-1 bigger-result"
           v-html="`Input structure: <span class='ml-2 result-label'>${formula}</span>`" />

  <v-label class="separator-title">Collection matcher</v-label>
  <slider-with-steppers v-model="state.numberMatches" v-model:raw="showNumberMatches"
                        class="mb-2 ml-0 mt-2" label-width="7rem"
                        :label="`Neighbors (${showNumberMatches})`"
                        :min="1" :max="8" :step="1" />
  <v-row class="mt-2 pr-2">
    <v-col>
      <v-switch v-model="state.noThreshold" label="No max distance" class="ml-1" />
    </v-col>
    <v-col>
      <v-number-input v-model="state.threshold" :disabled="state.noThreshold"
                      label="Max distance" :precision="2"
                      :step="0.01" :min="0.01" :max="1" class="ml-1 mr-2" />
    </v-col>
  </v-row>

  <v-container v-if="state.enabled && similar.length > 0" class="pa-0 mt-n6">
    <v-divider :thickness="5" class="border-opacity-50 mb-3"/>
    <v-container class="pt-0 pl-0 pr-2">
      <v-container v-for="entry of similar" :key="entry.id" v-ripple
                   class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                   @click="selectResult(entry.id, true)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer">
            {{ entry.title }}</v-label><br>
        <v-label class="bigger-result cursor-pointer">
            {{ `distance: ${entry.distance!.toFixed(4)}` }}</v-label>
      </v-container>
    </v-container>
  </v-container>

  <v-label class="separator-title mt-n2">Prototype matcher</v-label>
    <debounced-slider v-slot="{value}" v-model="state.lengthTolerance"
                      :min="0.05" :max="0.4" :step="0.05" class="mb-2 mt-2">
    <v-label :text="`Fractional length tolerance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="state.siteTolerance"
                      :min="0.05" :max="0.6" :step="0.05" class="mb-2 mt-2">
    <v-label :text="`Site tolerance (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <debounced-slider v-slot="{value}" v-model="state.angleTolerance"
                      :min="0.5" :max="10" :step="0.5" class="mb-2 mt-2">
    <v-label :text="`Angle tolerance (${value.toFixed(1)})`" class="no-select" />
  </debounced-slider>

  <v-container v-if="state.enabled && prototypes.length > 0" class="mt-2 mb-6 pa-0">
    <v-divider :thickness="5" class="border-opacity-50 mb-3"/>
    <v-container class="pa-0 pr-2">
      <v-container v-for="entry of prototypes" :key="entry[1]" v-ripple
                  class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                  @click="selectResult(entry[1], false)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer" v-html="entry[0]" /><br>
        <v-label class="bigger-result cursor-pointer">{{ `aflow: ${entry[1]}` }}</v-label>
      </v-container>
    </v-container>
  </v-container>

  <block-button class="mt-5 mb-0" label="Reset parameters" @click="resetParams" />
  <node-alert node="matchers" />
</v-container>
</template>


<style scoped>
:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}
</style>
