<script setup lang="ts">
/**
 * @component
 * Controls for the converter from structure data to graphical objects.
 */

import {ref, watchEffect, computed} from "vue";
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
const shadedBonds = ref(false);

sb.getUiParams(props.id, (params: UiParams) => {
    drawKind.value = params.drawKind as string ?? "ball-and-stick";
    drawQuality.value = params.drawQuality as number ?? 4;
    drawRoughness.value = params.drawRoughness as number ?? 0.5;
    drawMetalness.value = params.drawMetalness as number ?? 0.6;
    labelKind.value = params.labelKind as string ?? "symbol";
    showStructure.value = params.showStructure as boolean ?? true;
    showBonds.value = params.showBonds as boolean ?? true;
    showLabels.value = params.showLabels as boolean ?? true;
    shadedBonds.value = params.shadedBonds as boolean ?? false;
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
        showLabels: showLabels.value,
        shadedBonds: shadedBonds.value,
    });
});

// To convert the button toggle into three booleans
const showCombined = computed({
    get: () => {
        const result = [];
        if(showStructure.value) result.push("structure");
        if(showBonds.value) result.push("bonds");
        if(showLabels.value) result.push("labels");
        return result;
    },
    set: (values) => {
        showStructure.value = values.includes("structure");
        showBonds.value = values.includes("bonds");
        showLabels.value = values.includes("labels");
    }
});

</script>


<template>
<v-container class="container">
  <v-label text="Structure rendering mode" class="mb-3 ml-2 mt-4" /><br>
  <v-btn-toggle v-model="drawKind" color="primary" class="mb-6 ml-2">
    <v-btn value="ball-and-stick">CPK</v-btn>
    <v-btn value="van-der-walls">VdW</v-btn>
    <v-btn value="licorice">Licorice</v-btn>
    <v-btn value="lines">Lines</v-btn>
  </v-btn-toggle>

  <v-switch v-model="shadedBonds" color="primary"
            label="Smooth color bonds" density="compact" class="mt-2 ml-2" />

  <v-label text="Label is" class="mb-3 ml-2" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" class="mb-6 ml-2">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
  </v-btn-toggle><br>

  <v-label text="Visibility" class="ml-2 mb-3" /><br>
  <v-btn-toggle v-model="showCombined" multiple color="primary" class="ml-2 mb-4">
    <v-btn value="structure">Structure</v-btn>
    <v-btn value="bonds">Bonds</v-btn>
    <v-btn value="labels">Labels</v-btn>
  </v-btn-toggle>

  <v-label text="Quality" class="ml-2" /><br>
  <v-btn-toggle v-model="drawQuality" color="primary" class="mt-2 ml-2">
    <v-btn :value="1">Low</v-btn>
    <v-btn :value="2">Medium</v-btn>
    <v-btn :value="3">Good</v-btn>
    <v-btn :value="4">Best</v-btn>
  </v-btn-toggle>

  <g-debounced-slider v-slot="{value}" v-model="drawRoughness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-6">
    <v-label :text="`Roughness (${value.toFixed(2)})`" />
  </g-debounced-slider>
  <g-debounced-slider v-slot="{value}" v-model="drawMetalness"
                      :min="0" :max="1" :step="0.1" class="ml-2 mt-4">
    <v-label :text="`Metalness (${value.toFixed(2)})`" />
  </g-debounced-slider>
</v-container>
</template>
