<script setup lang="ts">
/**
 * @component
 * Controls for the volume data interpolator.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const properties = defineProps<{

    /** Its own module id */
    id: string;
}>();

const interpolateVolume = ref(false);
const pointsToAdd = ref(1);
const dataset = ref(0);
const maxDataset = ref(0);

sb.getUiParams(properties.id, (params: UiParams) => {
    interpolateVolume.value = params.interpolateVolume as boolean ?? false;
    pointsToAdd.value = params.pointsToAdd as number ?? 1;
    dataset.value = params.dataset as number ?? 0;
    maxDataset.value = params.maxDataset as number ?? 0;
});
watchEffect(() => {
    sb.setUiParams(properties.id, {
        interpolateVolume: interpolateVolume.value,
        pointsToAdd: pointsToAdd.value,
        dataset: dataset.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="interpolateVolume" color="primary" label="Interpolate volume data" class="mt-4 ml-4" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />
  <g-debounced-slider v-slot="{value}" v-model="pointsToAdd" :step="1" :min="1" :max="10"
                      :disabled="!interpolateVolume" class="ml-2 mt-1">
    <v-label :text="`Points to add (${value})`" />
  </g-debounced-slider>
</v-container>
</template>
