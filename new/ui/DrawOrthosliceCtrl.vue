<script setup lang="ts">
/**
 * @component
 * Controls for the orthoslice node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed} from "vue";
import {Lut} from "three/addons/math/Lut.js";

import {humanFormat} from "../services/HumanFormat";
import {askNode, receiveIsoOrthoFromNode} from "../services/RoutesClient";
import {showAlertMessage} from "../services/AlertMessage";
import type {CtrlParams} from "../types";
import {sm} from "../services/SceneManager";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
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
const limits = ref<number[]>([]);
const limitLow = ref(-10);
const limitHigh = ref(10);
const valueMin = ref(-10);
const valueMax = ref(10);
const useColorClasses = ref(false);
const colorClasses = ref(5);
const step = computed(() => (valueMax.value - valueMin.value)/100);

const showIsolines = ref(false);
const colorIsolines = ref(false);
const isoValue = ref((valueMax.value+valueMin.value)/2);

const lut = new Lut(colormapName.value, 512);

// > Initialize ui
askNode(id, "init")
    .then((params) => {
        showOrthoslice.value = params.showOrthoslice as boolean ?? false;
        dataset.value = params.dataset as number ?? 0;
        axis.value = params.axis as number ?? 0;
        plane.value = params.plane as number ?? 0;
        maxDataset.value = params.maxDataset as number ?? 0;
        maxPlane.value = params.maxPlane as number ?? 0;
        colormapName.value = params.colormapName as string ?? "rainbow";
        limitLow.value = params.limitLow as number ?? -10;
        limitHigh.value = params.limitHigh as number ?? 10;
        valueMin.value = params.valueMin as number ?? -10;
        valueMax.value = params.valueMax as number ?? 10;
        useColorClasses.value = params.useColorClasses as boolean ?? false;
        colorClasses.value = params.colorClasses as number ?? 5;
        showIsolines.value = params.showIsolines as boolean ?? false;
        isoValue.value = params.isoValue as number ?? 0;
        colorIsolines.value = params.colorIsolines as boolean ?? false;

        if(isoValue.value > limitHigh.value) isoValue.value = limitHigh.value;
        if(isoValue.value < limitLow.value)  isoValue.value = limitLow.value;

        limits.value[0] = limitLow.value;
        limits.value[1] = limitHigh.value;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for Orthoslice: ${error.message}`));

receiveIsoOrthoFromNode(id, "computed", (sides: number[],
											vertices: number[],
											values: number[],
											isolineVertices: number[][],
                                            isolineValues: number[],
											params: CtrlParams): void => {

        void sides;
        void vertices;
        void values;
        void isolineVertices;
        void params;
        console.log("Received", sides);

        // Remove the existing plane
        const meshName = `Orthoslice-${id}`;
        sm.deleteMesh(meshName);

        // Remove existing isolines
        const isolinesName = `Isolines-${id}`;
        sm.clearGroup(isolinesName, true);

        // Create the isoline colors
        const isolineColors = isolineValues.map((value) => lut.getColor(value).getHex());
        void isolineColors;
/*
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

		const mesh = new THREE.Mesh(geometry, material);
        mesh.name = meshName;
        mesh.visible = this.showOrthoslice;
        sm.add(mesh);

        // Add the isolines
        const group = isolines.getIsolinesGroup(isolinesName);
        group.visible = this.showIsolines;
        sm.add(group);
*/
});

/*
watchEffect(() => {
    sb.setUiParams(pr.id, {
        showOrthoslice: showOrthoslice.value,
        dataset: dataset.value,
        axis: axis.value,
        plane: plane.value,
        colormapName: colormapName.value,
        limitLow: limits.value[0],
        limitHigh: limits.value[1],
        colorClasses: colorClasses.value,
        useColorClasses: useColorClasses.value,
        showIsolines: showIsolines.value,
        isoValue: isoValue.value,
        colorIsolines: colorIsolines.value,
    });
});
*/
</script>


<template>
<v-container class="container">
  <v-switch v-model="showOrthoslice" color="primary" label="Show orthoslice" density="compact" class="mt-2 ml-3" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4" />
  <v-label text="Axis" class="ml-2 mb-3" /><br>
  <v-btn-toggle v-model="axis" color="primary" class="mb-6 ml-2">
    <v-btn :value="0">X</v-btn>
    <v-btn :value="1">Y</v-btn>
    <v-btn :value="2">Z</v-btn>
  </v-btn-toggle><br>

  <g-debounced-slider v-slot="{value}" v-model="plane"
                      :step="1" :min="0" :max="maxPlane" class="ml-2 my-4">
    <v-label :text="`Plane (${value})`" />
  </g-debounced-slider>

  <v-label :text="`Values range (${humanFormat(limitLow)} – ${humanFormat(limitHigh)})`" class="ml-2" />
  <v-range-slider v-model="limits" strict :step="step" :min="valueMin" :max="valueMax"
                  color="primary" class="ml-4 mt-1 pr-2" />

  <v-switch v-model="useColorClasses" color="primary"
            label="Use discrete classes" density="compact" class="ml-3" />
  <g-debounced-slider v-slot="{value}" v-model="colorClasses" :step="1" :min="2" :max="20"
                      :disabled="!useColorClasses" class="ml-2 mt-1 mb-4">
    <v-label :text="`Number of classes (${value})`" />
  </g-debounced-slider>

  <v-select v-model="colormapName" label="Colormap"
            :items="colormaps" class="mt-0 mx-2" density="compact" />

  <v-switch v-model="showIsolines" color="primary" label="Show isolines"
            density="compact" class="mt-2 ml-4" />
  <v-switch v-model="colorIsolines" color="primary" label="Color isolines"
            density="compact" class="ml-4 mt-n5" />
  <g-debounced-slider v-slot="{value}" v-model="isoValue" :step="step" :min="valueMin"
                      :max="valueMax" :disabled="useColorClasses" class="ml-2 mt-1">
    <v-label :text="`Isoline value (${humanFormat(value)})`" />
  </g-debounced-slider>
</v-container>
</template>
