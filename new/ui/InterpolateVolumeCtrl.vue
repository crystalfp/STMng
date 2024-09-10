<script setup lang="ts">
/**
 * @component
 * Controls for the volume data interpolator.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watchEffect} from "vue";
import {askNode, sendToNode, receiveFromNode} from "../services/RoutesClient";
import {showAlertMessage} from "../services/AlertMessage";
import type {CtrlParams} from "../types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

const interpolateVolume = ref(false);
const pointsToAdd = ref(1);
const dataset = ref(0);
const maxDataset = ref(0);

askNode(id, "init")
    .then((params) => {

		interpolateVolume.value = params.interpolateVolume as boolean ?? false;
		pointsToAdd.value = params.pointsToAdd as number ?? 1;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for InterpolateVolume: ${error.message}`));

receiveFromNode(id, "maxDataset", (params: CtrlParams) => {
    maxDataset.value = params.maxDataset as number ?? 0;
});

watchEffect(() => {
    sendToNode(id, "change", {
        interpolateVolume: interpolateVolume.value,
        pointsToAdd: pointsToAdd.value,
        dataset: dataset.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="interpolateVolume" color="primary"
            label="Interpolate volume data" class="mt-4 ml-4" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2 no-select" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1"
            :disabled="maxDataset === 0" class="ml-4 mt-1" />
  <g-debounced-slider v-slot="{value}" v-model="pointsToAdd" :step="1" :min="1" :max="10"
                      :disabled="!interpolateVolume" class="ml-2 mt-1">
    <v-label :text="`Points to add (${value})`" class="no-select" />
  </g-debounced-slider>
</v-container>
</template>
