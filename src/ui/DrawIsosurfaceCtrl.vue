<script setup lang="ts">
/**
 * @component
 * Controls for isosurfaces computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import * as THREE from "three";
import {Lut} from "three/addons/math/Lut.js";
import {ref, computed, watch} from "vue";
import {humanFormat} from "@/services/HumanFormat";
import {askNode, receiveIsosurfacesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {sm} from "@/services/SceneManager";
import type {CtrlParams} from "@/types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showIsosurface = ref(false);
const dataset = ref(0);
const maxDataset = ref(0);
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

/** Available colormaps */
const colormaps = ["rainbow", "cooltowarm", "blackbody", "grayscale"];

const group = new THREE.Group();
const groupName = "Isosurface-" + id;
group.name = groupName;
sm.add(group);

// > Colormap creation
const lut = computed(() => {

    const thatLut = new Lut(colormapName.value, 512);

    if(limitColormap.value) {
        thatLut.setMax(limits.value[1]);
        thatLut.setMin(limits.value[0]);
    }
    else {
        thatLut.setMax(valueMax.value);
        thatLut.setMin(valueMin.value);
    }

    return thatLut;
});

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
    .catch((error: Error) => showAlertMessage(`Error from UI init for Isosurface: ${error.message}`));

receiveIsosurfacesFromNode(id, "iso", (indices: number[][],
                                       vertices: number[][],
                                       normals: number[][],
                                       isoValues: number[],
                                       params: CtrlParams) => {

    // Remove existing surfaces
    sm.clearGroup(groupName);

    if(indices.length === 0) return;

    maxDataset.value = params.maxDataset as number ?? 0;
    valueMin.value = params.valueMin as number ?? -10;
    valueMax.value = params.valueMax as number ?? 10;

    if(params.changedStructure) {
        limits.value[0] = valueMin.value;
        limits.value[1] = valueMax.value;

        if(dataset.value > maxDataset.value) dataset.value = maxDataset.value;

        isoValue.value = (valueMin.value+valueMax.value)/2;
    }

    // Add single or nested isosurfaces
    for(let i=0; i < indices.length; ++i) {

        // Create and add the surface to the scene
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(indices[i]);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices[i], 3));
        geometry.setAttribute("normal",   new THREE.Float32BufferAttribute(normals[i], 3));

        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            color: lut.value.getColor(isoValues[i]).getHex(),
            opacity: opacity.value,
            roughness: 0.5,
            metalness: 0.6,
            transparent: opacity.value < 0.99,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {isoValue: isoValues[i]};
        group.add(mesh);
    }

    group.visible = showIsosurface.value;
});

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

    group.visible = showIsosurface.value;

    group.traverse((mesh) => {
        if(mesh.type !== "Mesh") return;
        const {isoValue: value} = mesh.userData;
        const material = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.opacity = opacity.value;
        material.transparent = opacity.value < 0.99;
        material.color = lut.value.getColor(value as number);
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showIsosurface" color="primary" label="Show isosurface"
            density="compact" class="mt-4 ml-3" />
  <v-label :text="`Dataset (${dataset})`" class="ml-2 no-select" />
  <v-slider v-model="dataset" min="0" :max="maxDataset" step="1" :disabled="maxDataset === 0" class="ml-4 mt-1" />

  <v-switch v-model="nestedIsosurfaces" color="primary" label="Nested isosurfaces"
            density="compact" class="mt-1 ml-3" />

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
    <v-switch v-model="limitColormap" color="primary" label="Limit colormap to range"
              density="compact" class="mt-1 ml-3" />
  </v-container>

  <v-container v-else class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="isoValue"
                        :step="step" :min="valueMin" :max="valueMax" class="ml-2 mt-1 mb-4">
      <v-label :text="`Isosurface value (${humanFormat(value)})`" class="no-select" />
    </g-debounced-slider>
  </v-container>

  <v-select v-model="colormapName" label="Colormap"
            :items="colormaps" class="mt-0 mx-2" density="compact" />

  <g-debounced-slider v-slot="{value}" v-model="opacity" :step="0.1" :min="0" :max="1" class="ml-2 mt-2">
    <v-label :text="`Opacity (${value.toFixed(1)})`" class="no-select" />
  </g-debounced-slider>
</v-container>
</template>
