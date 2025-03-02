<script setup lang="ts">
/**
 * @component
 * Controls for the orthoslice node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed, watch} from "vue";
import {humanFormat} from "@/services/HumanFormat";
import {askNode, receiveIsoOrthoFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {DrawOrthosliceRenderer} from "@/renderers/DrawOrthosliceRenderer";
import type {CtrlParams} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

const dataset = ref(0);
const axis = ref(0);
const plane = ref(0);
const showOrthoslice = ref<boolean|null>(false);
const countDatasets = ref(0);
const maxPlane = ref(0);
const colormapName = ref("rainbow");
const limits = ref<number[]>([-10, 10]); // User selected limits
const valueMin = ref(-10); // Range of the values in the volume
const valueMax = ref(10);
const useColorClasses = ref<boolean|null>(false);
const colorClasses = ref(5);
const step = computed(() => (valueMax.value-valueMin.value)/100);

const showIsolines = ref<boolean|null>(false);
const colorIsolines = ref<boolean|null>(false);
const isoValue = ref((valueMax.value+valueMin.value)/2);

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showOrthoslice.value = params.showOrthoslice as boolean ?? false;
        dataset.value = params.dataset as number ?? 0;
        axis.value = params.axis as number ?? 0;
        plane.value = params.plane as number ?? 0;
        countDatasets.value = params.countDatasets as number ?? 0;
        maxPlane.value = params.maxPlane as number ?? 0;
        colormapName.value = params.colormapName as string ?? "rainbow";
        valueMin.value = params.valueMin as number ?? -10;
        valueMax.value = params.valueMax as number ?? 10;
        useColorClasses.value = params.useColorClasses as boolean ?? false;
        colorClasses.value = params.colorClasses as number ?? 5;
        showIsolines.value = params.showIsolines as boolean ?? false;
        isoValue.value = params.isoValue as number ?? 0;
        colorIsolines.value = params.colorIsolines as boolean ?? false;

        if(isoValue.value > valueMax.value) isoValue.value = valueMax.value;
        if(isoValue.value < valueMin.value) isoValue.value = valueMin.value;

        limits.value[0] = valueMin.value;
        limits.value[1] = valueMax.value;

        if(countDatasets.value === 0) {
            showOrthoslice.value = false;
            showIsolines.value = false;
        }
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawOrthosliceRenderer(id);

let currentVertices: number[];
let currentIndices: number[];
let currentValues: number[];
let currentIsolineVertices: number[][];
let currentIsolineValues: number[];

// > Receive data to display orthoslice and isolines
receiveIsoOrthoFromNode(id, "computed", (vertices: number[],
                                         indices: number[],
										 values: number[],
										 isolineVertices: number[][],
                                         isolineValues: number[],
                                         params: CtrlParams): void => {

    // Update parameters
    countDatasets.value = params.countDatasets as number ?? 0;
    maxPlane.value = params.maxPlane as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;

    if(isoValue.value > valueMax.value) isoValue.value = valueMax.value;
    if(isoValue.value < valueMin.value) isoValue.value = valueMin.value;

    if(params.limitLow !== undefined) {
        limits.value[0] = params.limitLow as number;
        limits.value[1] = params.limitHigh as number;
    }

    if(countDatasets.value === 0) {
        showOrthoslice.value = false;
        showIsolines.value = false;
        return;
    }

    // Save values
    currentVertices = vertices;
    currentIndices = indices;
    currentValues = values;
    currentIsolineVertices = isolineVertices;
    currentIsolineValues = isolineValues;

    // Update the colormap
    renderer.setLut(colormapName.value, limits.value[0], limits.value[1],
                    useColorClasses.value!, colorClasses.value);

    // Draw orthoslice and isolines
    renderer.drawOrthoIso(vertices, indices, values, isolineVertices, isolineValues,
                          showOrthoslice.value!, showIsolines.value!, colorIsolines.value!);
});

// > Send updated parameters to main process
watch([dataset, axis, plane, colorClasses, useColorClasses,
       isoValue, showOrthoslice, showIsolines, limits], () => {

    sendToNode(id, "change", {
        dataset: dataset.value,
        axis: axis.value,
        plane: plane.value,
        colorClasses: colorClasses.value,
        useColorClasses: useColorClasses.value!,
        isoValue: isoValue.value,
        showOrthoslice: showOrthoslice.value!,
        showIsolines: showIsolines.value!,
        limitLow: limits.value[0],
        limitHigh: limits.value[1],
    });

    renderer.setVisibility(showIsolines.value!, showOrthoslice.value!);
}, {deep: true});

watch([colormapName, colorIsolines], () => {

    sendToNode(id, "show", {
        colormapName: colormapName.value,
        colorIsolines: colorIsolines.value!,
    });

    renderer.setLut(colormapName.value, limits.value[0], limits.value[1],
                    useColorClasses.value!, colorClasses.value);

    // Draw orthoslice and isolines
    renderer.drawOrthoIso(currentVertices, currentIndices, currentValues,
                          currentIsolineVertices, currentIsolineValues,
                          showOrthoslice.value!, showIsolines.value!, colorIsolines.value!);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showOrthoslice" label="Show orthoslice" class="mt-2 mb-4 ml-3" />

  <g-dataset-selector v-model="dataset" :count-datasets="countDatasets" />

  <v-row>
    <v-col cols="12" class="pa-0 ml-5 mt-2 mb-n2">
      <v-label text="Axis" class="no-select" />
    </v-col>
    <v-col>
      <v-btn-toggle v-model="axis" mandatory class="mb-2 ml-2">
        <v-btn :value="0">X</v-btn>
        <v-btn :value="1">Y</v-btn>
        <v-btn :value="2">Z</v-btn>
      </v-btn-toggle>
    </v-col>
  </v-row>
  <g-debounced-slider v-slot="{value}" v-model="plane"
                      :step="1" :min="0" :max="maxPlane" class="ml-2 my-4">
    <v-label :text="`Plane (${value})`" class="no-select"/>
  </g-debounced-slider>

  <g-debounced-range-slider v-slot="{values}" v-model="limits"
                            :step="step" :min="valueMin" :max="valueMax"
                            class="ml-4 mt-1 pr-4">
    <v-label :text="`Values range (${humanFormat(values[0])} – ${humanFormat(values[1])})`"
             class="ml-n2 no-select" />
  </g-debounced-range-slider>

  <v-switch v-model="useColorClasses" label="Use discrete classes" class="ml-3 mb-4" />
  <g-debounced-slider v-if="useColorClasses" v-slot="{value}" v-model="colorClasses"
                      :step="1" :min="2" :max="20" class="ml-2 mt-1 mb-4">
    <v-label :text="`Number of classes (${value})`" class="no-select"/>
  </g-debounced-slider>

  <g-select-colormap v-model="colormapName" class="mx-2" />

  <v-switch v-model="showIsolines" label="Show isolines" class="mt-6 ml-4" />
  <v-switch v-model="colorIsolines" label="Color isolines" class="ml-4 mb-5" />

  <g-debounced-slider v-if="!useColorClasses" v-slot="{value}" v-model="isoValue"
                      :step="step" :min="valueMin" :max="valueMax" class="ml-2 mt-1">
    <v-label :text="`Isoline value (${humanFormat(value)})`" class="no-select"/>
  </g-debounced-slider>
</v-container>
</template>
