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
const drawRoughness = ref(0.5);
const drawMetalness = ref(0.6);
const labelKind = ref("symbol");
const showStructure = ref(true);
const showBonds = ref(true);
const showLabels = ref(true);

sb.getUiParams(props.id, (params: UiParams) => {
    drawKind.value = params.drawKind as string ?? "ball-and-stick";
    drawQuality.value = params.drawQuality as number ?? 4;
    drawRoughness.value = params.drawRoughness as number ?? 0.5;
    drawMetalness.value = params.drawMetalness as number ?? 0.6;
    labelKind.value = params.labelKind as string ?? "symbol";
    showStructure.value = params.showStructure as boolean ?? true;
    showBonds.value = params.showBonds as boolean ?? true;
    showLabels.value = params.showLabels as boolean ?? true;
});

watchEffect(() => {
    sb.setUiParams(props.id, {
        drawKind: drawKind.value,
        drawQuality: drawQuality.value,
        drawRoughness: drawRoughness.value,
        drawMetalness: drawMetalness.value,
        labelKind: labelKind.value,
        showBonds: showBonds.value,
        showStructure: showStructure.value,
        showLabels: showLabels.value
    });
});

// Labels for the quality slider
const tickLabels = {1: "Low", 2: "Medium", 3: "Good", 4: "Best"};

</script>


<template>
<v-container class="container">
  <v-label text="Structure rendering mode" class="mb-3 ml-2" /><br>
  <v-btn-toggle v-model="drawKind" color="primary" class="mb-6 ml-2">
    <v-btn value="ball-and-stick">CPK</v-btn>
    <v-btn value="van-der-walls">VdW</v-btn>
    <v-btn value="licorice">Licorice</v-btn>
    <v-btn value="lines">Lines</v-btn>
  </v-btn-toggle>

  <v-label text="Label mode" class="mb-3 ml-2" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" class="mb-6 ml-2">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
  </v-btn-toggle>

  <v-switch v-model="showStructure" color="primary" label="Show structure" class="ml-3" />
  <v-switch v-model="showBonds" color="primary" label="Show bonds" class="mt-n5 ml-3" />
  <v-switch v-model="showLabels" color="primary" label="Show labels" class="mt-n5 ml-3" />
  <v-label text="Quality" class="ml-2" />
  <v-slider v-model="drawQuality" :ticks="tickLabels" min="1" max="4" step="1"
            show-ticks="always" tick-size="5" class="mr-4"/>
  <g-debounced-slider v-slot="{value}" v-model="drawRoughness" :min="0" :max="1" :step="0.1">
    <v-label :text="`Roughness (${value.toFixed(2)})`" class="ml-2 mt-5" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="drawMetalness" density="compact" min="0" max="1" step="0.1">
    <v-label :text="`Metalness (${value.toFixed(2)})`" class="ml-2 mt-4" />
  </g-debounced-slider>
</v-container>
</template>
