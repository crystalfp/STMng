<script setup lang="ts">
/**
 * @component
 * Controls for the prototype and collection matchers node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {onUnmounted, reactive, ref, toRaw, watch} from "vue";

import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CollectionIndexEntry} from "@/electron/modules/CollectionDb";

import BlockButton from "@/widgets/BlockButton.vue";
import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";

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

    numberMatches: 3,

    lengthTolerance: 0.2,
    siteTolerance: 0.3,
    angleTolerance: 5,
});

/**
 * Identifiers for the matched prototypes [title, aflow]
 * @notExported
 */
type Prototype = [title: string, aflow: string];

const similar = reactive<CollectionIndexEntry[]>([]);
const showParameters = ref(false);
const prototypes = reactive<Prototype[]>([]);
const formula = ref("");

/** The result selector is in the dead-time period */
let waiting = false;

// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {
        state.enabled = params.enableMatcher as boolean ?? false;
        state.numberMatches = params.numberMatches as number ?? 3;
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
const stopWatcher = watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

// Cleanup
onUnmounted(() => stopWatcher());

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
 * @param idOrAflow - Collection structure file ID or prototype Aflow UID
 * @param isCollection - True if the id comes from the collection results
 */
const selectResult = (idOrAflow: string, isCollection: boolean): void => {

    if(!idOrAflow || waiting) return;
    setTimeout(() => {waiting = false;}, 500);
    waiting = true;

    // Retrieve prototype
    askNode(id, "show", {id: idOrAflow, isCollection})
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
        numberMatches: 3,
    });
};

/**
 * Open a secondary window with the matches
 */
const showMatches = (): void => {

    if(prototypes.length === 0 && similar.length === 0) return;

    const idCollection: string[] = [];
    const titleCollection: string[] = [];
    const distance: number[] = [];
    const aflow: string[] = [];
    const titlePrototypes: string[] = [];

    for(const proto of prototypes) {
        aflow.push(proto[1]);
        titlePrototypes.push(proto[0]);
    }
    for(const coll of similar) {
        idCollection.push(coll.id);
        titleCollection.push(coll.title);
        distance.push(coll.distance!);
    }

    sendToNode(id, "matches", {
        idCollection,
        titleCollection,
        distance,
        aflow,
        titlePrototypes,
        id
    });
};
</script>


<template>
<v-container class="container">
  <v-switch v-model="state.enabled" label="Enable matchers" class="mt-4 ml-1 mb-2" />
  <v-label v-if="formula !== ''" class="pb-2 ml-1 bigger-result"
           v-html="`Input structure: <span class='ml-2 result-label'>${formula}</span>`" />

  <node-alert node="matchers" />

  <v-label class="separator-title">Prototype matches</v-label>
  <v-container v-if="state.enabled && prototypes.length > 0" class="mb-4 pa-0 pr-2">
      <v-container v-for="entry of prototypes" :key="entry[1]" v-ripple
                  class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                  @click="selectResult(entry[1], false)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer" v-html="entry[0]" /><br>
        <v-label class="bigger-result cursor-pointer">{{ `aflow: ${entry[1]}` }}</v-label>
      </v-container>
  </v-container>

  <v-label class="separator-title reduce-top">Collection matches</v-label>
  <v-container v-if="state.enabled && similar.length > 0" class="pt-0 pl-0 pr-2 pb-2">
      <v-container v-for="entry of similar" :key="entry.id" v-ripple
                   class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                   @click="selectResult(entry.id, true)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer">
            {{ entry.title }}</v-label><br>
        <v-label class="bigger-result cursor-pointer">
            {{ `distance: ${entry.distance!.toFixed(4)}` }}</v-label>
      </v-container>
  </v-container>

  <block-button label="Matchers parameters" class="mb-n2" @click="showParameters = !showParameters"/>
  <v-container v-if="showParameters" class="pa-0">
    <debounced-slider v-slot="{value}" v-model="state.numberMatches"
                        :min="1" :max="8" :step="1" class="mb-2 mt-2">
      <v-label :text="`Collection neighbors (${value})`" class="no-select" />
    </debounced-slider>
    <debounced-slider v-slot="{value}" v-model="state.lengthTolerance"
                      :min="0.05" :max="0.4" :step="0.05" class="mb-2 mt-2">
      <v-label :text="`Fractional length tolerance (${value.toFixed(2)})`" class="no-select" />
    </debounced-slider>
    <debounced-slider v-slot="{value}" v-model="state.siteTolerance"
                      :min="0.05" :max="0.6" :step="0.05" class="mb-2 mt-2">
      <v-label :text="`Site tolerance (${value.toFixed(2)})`" class="no-select" />
    </debounced-slider>
    <debounced-slider v-slot="{value}" v-model="state.angleTolerance"
                        :min="0.5" :max="10" :step="0.5" class="mb-0 mt-2">
      <v-label :text="`Angle tolerance (${value.toFixed(1)})`" class="no-select" />
    </debounced-slider>
    <block-button class="mt-5 mb-n2" label="Reset parameters" @click="resetParams" />
  </v-container>
  <block-button label="Show matches" class="mt-2"
                :disabled="prototypes.length === 0 && similar.length === 0"
                @click="showMatches"/>
</v-container>
</template>


<style scoped>
:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}

.reduce-top {
  margin-top: -4px !important;
}
</style>
