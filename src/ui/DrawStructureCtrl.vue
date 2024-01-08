<script setup lang="ts">
/**
 * @component
 * Controls for the converter from Structure data to graphical objects
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Get and set ui parameters from the switchboard
const drawKind = ref("");
const drawQuality = ref(4);
const drawRoughness = ref(0.7);
const drawMetalness = ref(0.3);
const showLabels = ref(true);

sb.getUiParams(props.id, (params: UiParams) => {
    drawKind.value = params.drawKind as string ?? "ball-and-stick";
    drawQuality.value = params.drawQuality as number ?? 4;
    drawRoughness.value = params.drawRoughness as number ?? 0.7;
    drawMetalness.value = params.drawMetalness as number ?? 0.3;
    showLabels.value = params.showLabels as boolean ?? true;
});

watchEffect(() => {
    sb.setUiParams(props.id, {
        drawKind: drawKind.value,
        drawQuality: drawQuality.value,
        drawRoughness: drawRoughness.value,
        drawMetalness: drawMetalness.value,
        showLabels: showLabels.value
    });
});

const tickLabels = ref({1: "Low", 2: "Medium", 3: "Good", 4: "Best"});
</script>


<template>
<v-container class="container">
  <v-label text="Structure rendering mode" class="mb-3 ml-2" />
  <v-radio-group v-model="drawKind" class="ml-1" inline>
    <v-radio label="CPK" value="ball-and-stick" />
    <v-spacer />
    <v-radio label="VdW" value="van-der-walls" />
    <v-spacer />
    <v-radio label="Licorice" value="licorice" />
    <v-spacer />
    <v-radio label="Lines" value="lines" />
  </v-radio-group>
  <v-switch v-model="showLabels" color="primary" label="Show labels" class="ml-2" />
  <v-label text="Quality" class="ml-2" />
  <v-slider v-model="drawQuality" :ticks="tickLabels" min="1" max="4" step="1"
            show-ticks="always" tick-size="4" />
  <v-label text="Roughness" class="ml-2 mt-3" />
  <v-slider v-model="drawRoughness" density="compact" min="0" max="1" step="0.1" thumb-label />
  <v-label text="Metalness" class="ml-2" />
  <v-slider v-model="drawMetalness" density="compact" min="0" max="1" step="0.1" thumb-label />
</v-container>
</template>
