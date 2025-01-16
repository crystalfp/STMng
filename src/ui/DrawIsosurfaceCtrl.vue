<script setup lang="ts">
/**
 * @component
 * Controls for isosurfaces computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed, watch} from "vue";
import {humanFormat} from "@/services/HumanFormat";
import {askNode, receiveIsosurfacesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {DrawIsosurfaceRenderer} from "@/renderers/DrawIsosurfaceRenderer";
import type {CtrlParams} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

const showIsosurface = ref(false);
const dataset = ref(0);
const countDatasets = ref(0);
const valueMin = ref(-10);
const valueMax = ref(10);
const isoValue = ref((valueMax.value+valueMin.value)/2);
const step = computed(() => (valueMax.value - valueMin.value)/100);
const colormapName = ref("rainbow");
const opacity = ref(1);

const nestedIsosurfaces = ref(false);
const countIsosurfaces = ref(2);
const limits = ref<number[]>([-10, 10]);
const limitColormap = ref(false);

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showIsosurface.value = params.showIsosurface as boolean ?? false;
        dataset.value = params.dataset as number ?? 0;

        nestedIsosurfaces.value = params.nestedIsosurfaces as boolean ?? false;

        isoValue.value = params.isoValue as number ?? 0;

        colormapName.value = params.colormapName as string ?? "rainbow";
        opacity.value = params.opacity as number ?? 1;

        countIsosurfaces.value = params.countIsosurfaces as number ?? 2;
        limits.value[0] = params.limitLow as number ?? -10;
        limits.value[1] = params.limitHigh as number ?? 10;
        limitColormap.value = params.limitColormap as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawIsosurfaceRenderer(id);

/** Receive the data from the main process */
receiveIsosurfacesFromNode(id, "iso", (indices: number[][],
                                       vertices: number[][],
                                       normals: number[][],
                                       isoValues: number[],
                                       params: CtrlParams) => {

    countDatasets.value = params.countDatasets as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;

    if(params.changedStructure) {
        limits.value[0] = valueMin.value;
        limits.value[1] = valueMax.value;

        if(dataset.value >= countDatasets.value) dataset.value = countDatasets.value - 1;

        isoValue.value = (valueMin.value+valueMax.value)/2;
    }

    // Draw isosurfaces
    renderer.drawIsosurfaces(indices, vertices, normals, isoValues, opacity.value, showIsosurface.value);
});

watch([limitColormap, colormapName, limits, valueMin, valueMax], () => {

    // Set colormap
    if(limitColormap.value) {
        renderer.setLut(colormapName.value, limits.value[0], limits.value[1]);
    }
    else {
        renderer.setLut(colormapName.value, valueMin.value, valueMax.value);
    }
}, {deep: true});

// To recompute the isosurfaces
watch([dataset, nestedIsosurfaces, countIsosurfaces, limits, isoValue], () => {

    sendToNode(id, "change", {

        dataset: dataset.value,
        nestedIsosurfaces: nestedIsosurfaces.value,
        countIsosurfaces: countIsosurfaces.value,
        limitLow: limits.value[0],
        limitHigh: limits.value[1],
        isoValue: isoValue.value,
    });

}, {deep: true});

// To change locally
watch([showIsosurface, limitColormap, colormapName, opacity], () => {

    sendToNode(id, "show", {
        showIsosurface: showIsosurface.value,
        limitColormap: limitColormap.value,
        colormapName: colormapName.value,
        opacity: opacity.value
    });

    renderer.changeRendering(showIsosurface.value, opacity.value);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showIsosurface" label="Show isosurface" class="mt-4 ml-3" />

  <g-dataset-selector v-model="dataset" :count-datasets="countDatasets" />

  <v-switch v-model="nestedIsosurfaces" label="Nested isosurfaces" class="mt-1 ml-3" />

  <v-container v-if="nestedIsosurfaces" class="pa-0 pl-2">
    <g-debounced-slider v-slot="{value}" v-model="countIsosurfaces"
                        :step="1" :min="2" :max="10" class="mb-4">
      <v-label :text="`Number of isosurfaces (${value})`" class="no-select" />
    </g-debounced-slider>
    <g-debounced-range-slider v-slot="{values}" v-model="limits"
                              :step="step" :min="valueMin" :max="valueMax"
                              class="ml-4 mt-1 pr-4">
      <v-label :text="`Values range (${humanFormat(values[0])} – ${humanFormat(values[1])})`"
               class="ml-n2 no-select"/>
    </g-debounced-range-slider>
    <v-switch v-model="limitColormap" label="Limit colormap to range" class="mt-1 ml-3" />
  </v-container>

  <v-container v-else class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="isoValue"
                        :step="step" :min="valueMin" :max="valueMax" class="ml-2 mt-1 mb-4">
      <v-label :text="`Isosurface value (${humanFormat(value)})`" class="no-select" />
    </g-debounced-slider>
  </v-container>

  <g-select-colormap v-model="colormapName" class="mt-0 mx-2" />

  <g-debounced-slider v-slot="{value}" v-model="opacity" :step="0.1" :min="0" :max="1" class="ml-2 mt-2">
    <v-label :text="`Opacity (${value.toFixed(1)})`" class="no-select" />
  </g-debounced-slider>
</v-container>
</template>
