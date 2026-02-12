<script setup lang="ts">
/**
 * @component
 * Controls for the collection matcher node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-10
 */
import {ref, reactive, watch, toRaw} from "vue";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CollectionIndexEntry} from "@/electron/modules/CollectionDb";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
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
    noThreshold: false,
    threshold: 0.01,
    numberMatches: 1
});

const hasInput = ref(true);
const showNumberMatches = ref(1);
const similar = reactive<CollectionIndexEntry[]>([]);

const selectResult = (fileID: string): void => {
    console.log("Select", fileID); // TBD
};


// > Initialize ui
resetNodeAlert();

askNode(id, "init")
    .then((params) => {
		    state.enabled = params.enableMatcher as boolean ?? false;
        state.noThreshold = params.noThreshold as boolean ?? false;
        state.numberMatches = params.numberMatches as number ?? 1;
        state.threshold = params.threshold as number ?? 0.01;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for "${label}": ${error.message}`,
                      "collectionMatcher");
    });

/** Pass state changes to the main process for saving in the project file */
watch(state, (after) => {

    sendToNode(id, "state", toRaw(after));
});

/** Parameter changes */

/** Receive the parameters of the structures loaded */
receiveFromNode(id, "load", (params) => {

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

</script>


<template>
<v-container class="container">
  <v-switch v-model="state.enabled" label="Enable collection matcher" class="mt-6 ml-3" />
  <slider-with-steppers v-model="state.numberMatches" v-model:raw="showNumberMatches"
                        class="mb-2 ml-2 mt-2" label-width="7rem"
                        :label="`Neighbors (${showNumberMatches})`"
                        :min="1" :max="8" :step="1" />
  <v-row class="mt-2 pr-2">
    <v-col>
      <v-switch v-model="state.noThreshold" label="No max distance" class="ml-3" />
    </v-col>
    <v-col>
      <v-number-input v-model="state.threshold" :disabled="state.noThreshold"
                      label="Max. distance" :precision="2"
                      :step="0.01" :min="0.01" :max="1" class="ml-1" />
    </v-col>
  </v-row>
  <v-container v-if="state.enabled && hasInput" class="pa-0 mt-n6">
    <v-label class="separator-title">Similar structures</v-label>
    <v-container v-for="entry of similar" :key="entry.id" v-ripple
                  class="mb-3 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                  @click="selectResult(entry.id)">
      <v-label class="result-label pb-1 bigger-result cursor-pointer">
          {{ entry.title }}</v-label><br>
      <v-label class="bigger-result cursor-pointer">
          {{ `distance: ${entry.distance!.toFixed(4)}` }}</v-label>
    </v-container>
  </v-container>
  <node-alert node="collectionMatcher" />
</v-container>
</template>
