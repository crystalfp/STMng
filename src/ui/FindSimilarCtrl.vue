<script setup lang="ts">
/**
 * @component
 * Controls for the prototype and collection matchers node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-10-25
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
import {onUnmounted, reactive, ref, toRaw, watch} from "vue";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";

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
});

const spaceGroup = ref("");
const showDetails = ref(false);
const formula = ref("");
const showParameters = ref(false);

/** The result selector is in the dead-time period */
let waiting = false;

/**
 * Match result entry
 * @notExported
 */
interface ResultEntry {
	/** Unique structure identifier */
	idx: number;
	/** User facing structure title */
	title: string;
    /** True if from prototype db else from collection */
    isPrototype: boolean;
    /** Aflow UID if this is a prototype, otherwise empty string */
    aflow: string;
	/** Distance from the given structure  */
	distance: number;
    /** Color for the grouped distances */
    color: string;
}

const results = reactive<ResultEntry[]>([]);

/** Color legend */
const showLegend = ref(false);
const colorRanges = reactive([
    {color: "#FF1700", range: "over 0.15",   label: "questionable relatives"},
    {color: "#FFC200", range: "0.12 - 0.15", label: "distant relatives"},
    {color: "#D5FF00", range: "0.04 - 0.12", label: "related structures"},
    {color: "#00FF00", range: "up to 0.04",  label: "identical structures"},
]);

// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {
        state.enabled = params.enableMatcher as boolean ?? false;
        state.numberMatches = params.numberMatches as number ?? 3;

        results.length = 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for "${label}": ${error.message}`,
                      "matchers");
    });

/** Receive input info from main */
receiveFromNode(id, "load-info", (params) => {

    if(params.error) {
        showNodeAlert(`Error loading structure for "${label}": ${params.error as string}`,
                      "matchers");
        formula.value = "";
        spaceGroup.value = "";
        return;
    }

    formula.value = params.formula as string ?? "";
    spaceGroup.value = params.spaceGroup as string ?? "";
});

/**
 * Ask main to send input data info from main
 *
 * @param show - Status of the "show info" toggle
 */
const showDetailsChanged = (show: boolean | null): void => {

    formula.value = "";
    spaceGroup.value = "";
    if(show) sendToNode(id, "info");
};

/** Pass state changes to the main process for saving in the project file */
const stopWatcher = watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

// Cleanup
onUnmounted(() => stopWatcher());

/** Receive the parameters of the structures found */
receiveFromNode(id, "results", (params) => {

    const indices = params.idCollections as number[] ?? [];
    const titles = params.titleCollections as string[] ?? [];
    const distances = params.distances as number[] ?? [];
    const isPrototype = params.isPrototype as number[] ?? [];
    const aflow = params.aflow as string[] ?? [];
    const colors = params.colors as string[] ?? [];

    const len = indices.length;
    results.length = len;
    for(let i=0; i < len; ++i) {
        results[i] = {
            idx: indices[i],
            title: titles[i],
            distance: distances[i],
            isPrototype: isPrototype[i] !== 0,
            aflow: aflow[i],
            color: colors[i]
        };
    }
});

/**
 * Display in a secondary window the corresponding structure
 *
 * @param fileId - Collection structure file ID
 */
const selectResult = (fileId: number): void => {

    if(fileId === undefined || waiting) return;
    setTimeout(() => {waiting = false;}, 500);
    waiting = true;

    // Open secondary window on the selected structure
    askNode(id, "show", {id: fileId})
        .then((result) => {
            if(result.error) throw Error(result.error as string);
        })
        .catch((error: Error) => {
            showNodeAlert(error.message, "matchers");
        });
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="state.enabled" label="Enable matchers" class="mt-4 ml-1" />
  <v-switch v-model="showDetails" label="Show input details" class="mt-n2 ml-1 mb-0"
            @update:model-value="showDetailsChanged"/>
  <v-container v-if="showDetails" class="pl-1 pt-2 pb-0">
    <v-row>
      <v-label text="Structure:" class="bigger-result no-select mt-n2" />
    </v-row>
    <v-row>
      <v-label class="pb-2 bigger-result ml-2 result-label show-formula" v-html="formula" />
    </v-row>
    <v-row>
      <v-label text="Symmetry:" class="bigger-result no-select mt-n2" />
    </v-row>
    <v-row>
      <v-label :text="spaceGroup" class="show-symmetry result-label bigger-result" />
    </v-row>
  </v-container>

  <node-alert node="matchers" />

  <v-label class="separator-title">Matching structures</v-label>
  <v-container v-if="state.enabled && results.length > 0" class="mb-4 pa-0 pr-2">
      <v-container v-for="entry of results" :key="entry.idx" v-ripple
                  class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                  @click="selectResult(entry.idx)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer" v-html="entry.title" /><br>
        <v-container v-if="entry.isPrototype" class="pa-0">
          <v-label class="bigger-result cursor-pointer">
                   {{ `aflow: ${entry.aflow}` }}</v-label><br>
        </v-container>
        <v-label class="bigger-result cursor-pointer mr-1">distance:</v-label>
        <v-label class="bigger-result cursor-pointer" :style="{color: entry.color}">
            {{ entry.distance.toFixed(4) }}</v-label>
      </v-container>
  </v-container>

  <v-switch v-model="showLegend" label="Show color legend" class="mt-n3 ml-1 mb-n1" />
  <v-container v-if="showLegend" class="pb-0">
    <div v-for="n of colorRanges" :key="n.color" class="d-flex mb-1">
      <span :style="{backgroundColor: n.color}" class="mr-3">&emsp;</span>
      <span style="width: 5.5rem; margin-right: 3px">{{ n.range }}</span>{{ n.label }}
    </div>
  </v-container>

  <block-button label="Matchers parameters" class="mb-n2 mt-4"
                @click="showParameters = !showParameters"/>
  <v-container v-if="showParameters" class="pa-0">
    <debounced-slider v-slot="{value}" v-model="state.numberMatches"
                      :min="1" :max="8" :step="1" class="mb-2 mt-2">
      <v-label :text="`Collection neighbors (${value})`" class="no-select" />
    </debounced-slider>
  </v-container>
  <block-button label="Show matches" class="mt-2"
                :disabled="results.length === 0"
                @click="sendToNode(id, 'matches')"/>
</v-container>
</template>


<style scoped>
:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}

.show-formula {
  font-size: 1.2rem;
  margin-left: 2rem;
  font-family: monospace;
  letter-spacing: 1px;
}

.show-symmetry {
  font-family: monospace;
  margin-left: 2rem;
  font-size: 1.2rem;
}

</style>
