<script setup lang="ts">
/**
 * @component
 * Controls for the orthoslice node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed, watchEffect} from "vue";
import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {humanFormat} from "@/services/HumanFormat";
import {askNode, receiveIsoOrthoFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {sm} from "@/services/SceneManager";
import type {CtrlParams} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

const dataset = ref(0);
const axis = ref(0);
const plane = ref(0);
const showOrthoslice = ref(false);
const maxDataset = ref(0);
const maxPlane = ref(0);
const colormapName = ref("rainbow");
const limits = ref<number[]>([-10, 10]); // User selected limits
const valueMin = ref(-10); // Range of the values in the volume
const valueMax = ref(10);
const useColorClasses = ref(false);
const colorClasses = ref(5);
const step = computed(() => (valueMax.value-valueMin.value)/100);

const showIsolines = ref(false);
const colorIsolines = ref(false);
const isoValue = ref((valueMax.value+valueMin.value)/2);

// > Colormap creation
const lut = computed(() => {

    const thatLut = new Lut(colormapName.value,
                            useColorClasses.value ? colorClasses.value : 512);

    thatLut.setMax(limits.value[1]);
    thatLut.setMin(limits.value[0]);

    return thatLut;
});

// > The resulting graphical objects
let orthosliceMesh: THREE.Mesh | undefined;
const meshName = "Orthoslice-" + id;

let isolinesGroup: THREE.Group | undefined;
const isolinesName = "Isolines-" + id;

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showOrthoslice.value = params.showOrthoslice as boolean ?? false;
        dataset.value = params.dataset as number ?? 0;
        axis.value = params.axis as number ?? 0;
        plane.value = params.plane as number ?? 0;
        maxDataset.value = params.maxDataset as number ?? 0;
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
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

/**
 * Draw orthoslice and isolines
 *
 * @param vertices - Coordinates of the vertices of the orthoslice
 * @param indices - List of indices of the triangles composing the orthoslice
 * @param values - Values of each point on the orthoslice
 * @param isolineVertices - Coordinates of the various isolines
 * @param isolineValues - Values for each isoline
 */
const drawOrthoIso = (vertices: number[],
                      indices: number[],
                      values: number[],
                      isolineVertices: number[][],
                      isolineValues: number[]): void => {

    // Remove the existing plane
    sm.deleteMesh(meshName);

    // Remove existing isolines
    sm.clearGroup(isolinesName, true);
    isolinesGroup = new THREE.Group();
    isolinesGroup.name = isolinesName;
    sm.add(isolinesGroup);

    // Sanity check
    if(!vertices || !indices || !values || !isolineVertices || !isolineValues) return;
    if(vertices.length === 0 || indices.length === 0 || values.length === 0 ||
       isolineVertices.length === 0 || isolineValues.length === 0) return;

    // Create the isoline colors
    const isolineColors = isolineValues.map((value) => lut.value.getColor(value).getHex());

    // Create the orthoslice colors
    const colors: number[] = [];
    for(const oneValue of values) {
        const color = lut.value.getColor(oneValue);
        colors.push(color.r, color.g, color.b);
    }

    // Create and add the plane to the scene with no lighting effects
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: 1
    });

    orthosliceMesh = new THREE.Mesh(geometry, material);
    orthosliceMesh.name = meshName;
    orthosliceMesh.visible = showOrthoslice.value;
    sm.add(orthosliceMesh);

    // Add the isolines
    const countIsolines = isolineVertices.length;
    for(let idx=0; idx < countIsolines; ++idx) {

        const orthoGeometry = new THREE.BufferGeometry();
        orthoGeometry.setAttribute("position", new THREE.Float32BufferAttribute(isolineVertices[idx], 3));

        const color = colorIsolines.value ? isolineColors[idx] : 0x000000;
        const line = new THREE.LineSegments(orthoGeometry, new THREE.LineBasicMaterial({color}));
        isolinesGroup.add(line);
    }

    isolinesGroup.visible = showIsolines.value;
};

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
    maxDataset.value = params.maxDataset as number ?? 0;
    maxPlane.value = params.maxPlane as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;

    if(isoValue.value > valueMax.value) isoValue.value = valueMax.value;
    if(isoValue.value < valueMin.value) isoValue.value = valueMin.value;

    if(params.limitLow !== undefined) {
        limits.value[0] = params.limitLow as number;
        limits.value[1] = params.limitHigh as number;
    }

    // Save values
    currentVertices = vertices;
    currentIndices = indices;
    currentValues = values;
    currentIsolineVertices = isolineVertices;
    currentIsolineValues = isolineValues;

    // Draw orthoslice and isolines
    drawOrthoIso(vertices, indices, values, isolineVertices, isolineValues);
});

// > Send updated parameters to main process
watchEffect(() => {

    sendToNode(id, "change", {
        dataset: dataset.value,
        axis: axis.value,
        plane: plane.value,
        colorClasses: colorClasses.value,
        useColorClasses: useColorClasses.value,
        isoValue: isoValue.value,
        showOrthoslice: showOrthoslice.value,
        showIsolines: showIsolines.value,
        limitLow: limits.value[0],
        limitHigh: limits.value[1],
    });

    if(isolinesGroup) isolinesGroup.visible = showIsolines.value;
    if(orthosliceMesh) orthosliceMesh.visible = showOrthoslice.value;
    sm.modified();
});

watchEffect(() => {

    sendToNode(id, "show", {
        colormapName: colormapName.value,
        colorIsolines: colorIsolines.value,
    });

    // Draw orthoslice and isolines
    drawOrthoIso(currentVertices, currentIndices, currentValues,
                 currentIsolineVertices, currentIsolineValues);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showOrthoslice" color="primary" label="Show orthoslice"
            density="compact" class="mt-2 ml-3" />

  <v-label :text="`Dataset (${dataset})`" class="ml-2 no-select" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1"
            :disabled="maxDataset === 0" class="ml-4" />

  <v-label text="Axis" class="ml-2 mb-3 no-select" /><br>
  <v-btn-toggle v-model="axis" color="primary" mandatory class="mb-6 ml-2">
    <v-btn :value="0">X</v-btn>
    <v-btn :value="1">Y</v-btn>
    <v-btn :value="2">Z</v-btn>
  </v-btn-toggle><br>

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

  <v-switch v-model="useColorClasses" color="primary"
            label="Use discrete classes" density="compact" class="ml-3" />
  <g-debounced-slider v-if="useColorClasses" v-slot="{value}" v-model="colorClasses"
                      :step="1" :min="2" :max="20" class="ml-2 mt-1 mb-4">
    <v-label :text="`Number of classes (${value})`" class="no-select"/>
  </g-debounced-slider>

  <v-select v-model="colormapName" label="Colormap"
            :items="colormaps" class="mt-0 mx-2" density="compact" />

  <v-switch v-model="showIsolines" color="primary" label="Show isolines"
            density="compact" class="mt-2 ml-4" />
  <v-switch v-model="colorIsolines" color="primary" label="Color isolines"
            density="compact" class="ml-4 mt-n5" />

  <g-debounced-slider v-if="!useColorClasses" v-slot="{value}" v-model="isoValue"
                      :step="step" :min="valueMin" :max="valueMax" class="ml-2 mt-1">
    <v-label :text="`Isoline value (${humanFormat(value)})`" class="no-select"/>
  </g-debounced-slider>
</v-container>
</template>
