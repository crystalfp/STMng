<script setup lang="ts">
/**
 * @component
 * Controls for the measure atoms positions, distances and angles node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-09
 */

import * as THREE from "three";
import {ref, watch} from "vue";
import {storeToRefs} from "pinia";
import {sm} from "@/services/SceneManager";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import {askNode, receiveFromNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import type {SelectedAtom} from "@/types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Access the stores
const controlStore = useControlStore();
const configStore = useConfigStore();

// The measures to be visualized
const distanceAB = ref(-1);
const distanceBC = ref(-1);
const distanceAC = ref(-1);
const angleABC   = ref(-1);
const volume     = ref(-1);
const details    = ref<SelectedAtom[]>([]);

/** Show fractional coordinates */
const useFractional = ref(false);

// Prepare the graphical part
const group = new THREE.Group();
const groupName = "AtomSelectors-" + id;
group.name = groupName;
sm.add(group);

/**
 * Compute the polyhedron volume using the formula found here:
 * https://mathworld.wolfram.com/PolyhedronVolume.html
 *
 * @param vertices - Polyhedron geometry vertices coordinates.
 *					 Each three consecutive vertices form a triangle
 * @param numberVertices - Total number of vertices
 * @returns The polyhedron volume
 */
const computeVolume = (vertices: THREE.TypedArray, numberVertices: number): number => {

    let computedVolume = 0;
    for(let i=0; i < numberVertices/3; ++i) {

        const startIdx = i*9;

        const vu = [
            vertices[startIdx+3] - vertices[startIdx],
            vertices[startIdx+4] - vertices[startIdx+1],
            vertices[startIdx+5] - vertices[startIdx+2]
        ];
        const vv = [
            vertices[startIdx+6] - vertices[startIdx],
            vertices[startIdx+7] - vertices[startIdx+1],
            vertices[startIdx+8] - vertices[startIdx+2]
        ];
        const normal = [
            vu[1] * vv[2] - vu[2] * vv[1],
            vu[2] * vv[0] - vu[0] * vv[2],
            vu[0] * vv[1] - vu[1] * vv[0]
        ];

        computedVolume += vertices[startIdx]*normal[0] +
                          vertices[startIdx+1]*normal[1] +
                          vertices[startIdx+2]*normal[2];
    }

    // Compute volume
    return computedVolume/6;
};

// Watch atoms selection
watch(controlStore.atomsSelected, () => {

    const atsel = controlStore.atomsSelected;
    askNode(id, "compute", {
        idx1: atsel[0],
        idx2: atsel[1],
        idx3: atsel[2],
    })
    .then((params) => {

        distanceAB.value = params.distanceAB as number ?? -1;
        distanceBC.value = params.distanceBC as number ?? -1;
        distanceAC.value = params.distanceAC as number ?? -1;
        angleABC.value   = params.angleABC as number ?? -1;
        details.value    = JSON.parse(params.details as string ?? "[]") as SelectedAtom[];

        const pointSize = configStore.isPerspectiveCamera ? 0.3 : 6;
		sm.clearGroup(groupName);
        for(const detail of details.value) {
            const geom = new THREE.IcosahedronGeometry(detail.radius*0.6, 4);
            const mat = new THREE.PointsMaterial({color: detail.color, size: pointSize});
            const points = new THREE.Points(geom, mat);
            points.position.set(detail.position[0], detail.position[1], detail.position[2]);
            group.add(points);
        }
    })
    .catch((error: Error) => showAlertMessage(`Error from computing measures: ${error.message}`));
});

// Remove selection on structure change
receiveFromNode(id, "reset", () => {
    controlStore.deselectAll();
    sm.clearGroup(groupName);
});

// Watch polyhedra selection
const {polyhedronNewIdx} = storeToRefs(controlStore);
watch(polyhedronNewIdx, () => {

    // No polyhedra selected
    if(controlStore.polyhedronNewIdx === undefined) return;

    let objectCurrent: THREE.Mesh;
    let objectNew: THREE.Mesh;
    sm.scene.traverse((object) => {
        if(object.name === "Polyhedron") {
            if(object.userData.idx === controlStore.polyhedronNewIdx) {
                objectNew = object as THREE.Mesh;
            }
            if(object.userData.idx === controlStore.polyhedronCurrentIdx) {
                objectCurrent = object as THREE.Mesh;
            }
        }
    });

    // Click on the same poly deselects it
    if(controlStore.polyhedronNewIdx === controlStore.polyhedronCurrentIdx) {

        (objectCurrent!.material as THREE.MeshLambertMaterial).color =
            new THREE.Color(controlStore.polyhedronCurrentColor);
        controlStore.polyhedronCurrentIdx = undefined;
        controlStore.polyhedronNewIdx = undefined;

        volume.value = -1;
    }
    else {
        // Deselect current selection
        if(controlStore.polyhedronCurrentIdx !== undefined) {

            (objectCurrent!.material as THREE.MeshLambertMaterial).color =
                new THREE.Color(controlStore.polyhedronCurrentColor);
            controlStore.polyhedronCurrentIdx = undefined;
        }

        // Select new poly
        (objectNew!.material as THREE.MeshLambertMaterial).color = new THREE.Color("#FF0000");

        // Move the control to the new poly
        controlStore.polyhedronCurrentIdx = controlStore.polyhedronNewIdx;
        controlStore.polyhedronCurrentColor = controlStore.polyhedronNewColor;
        controlStore.polyhedronNewIdx = undefined;

        const positions = objectNew!.geometry.getAttribute("position");
        volume.value = computeVolume(positions.array, positions.count);
    }
});

/**
 * Format one coordinate (cartesian of fractional) of the selected atom.
 *
 * @param detail - Selected atom details
 * @param idx - Coordinate index to visualize
 * @returns Formatted atom coordinate (cartesian of fractional)
 */
const showCoords = (detail: SelectedAtom, idx: number): string => {

    if(useFractional.value) {
        const fr = detail.fractional[idx];
        return fr === -1 ? "none" : fr.toFixed(3);
    }
    return detail.position[idx].toFixed(3);
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="useFractional" label="Show fractional coordinates"
            color="primary" density="compact" class="ml-4 mt-2 mb-n4"/>
  <v-label class="text-h5 w-100 justify-center yellow-title mb-2 no-select">Selected atoms</v-label>
  <v-table v-if="details.length > 0" density="default" class="pa-1 pr-5">
    <tr v-for="line of details" :key="line.index">
      <td :style="`color: ${line.color};width:3rem`">{{ line.label }}</td>
      <td style="width: 1rem">{{ line.symbol }}</td>
      <td style="width: 3rem;text-align:right">[</td>
      <td style="width: 1rem;text-align:right">{{ `${showCoords(line, 0)},` }}</td>
      <td style="width: 2rem;text-align:right">{{ `${showCoords(line, 1)},` }}</td>
      <td style="width: 2rem;text-align:right">{{ `${showCoords(line, 2)}` }}</td>
      <td style="width: 0.5rem;text-align:right">]</td>
    </tr>
  </v-table>
  <v-label class="text-h5 w-100 justify-center yellow-title mb-2 no-select">Measures</v-label>
  <v-table v-if="distanceAB > 0" density="default" class="pa-1 pr-5">
    <tr>
    <td style="width:9rem">Distance <span style="color: #FF0000">A</span>–<span style="color: #00C300">B</span>:</td>
    <td style="text-align:right">{{ distanceAB.toFixed(5) }}</td></tr>
    <tr v-if="distanceBC > 0">
    <td>Distance <span style="color: #00C300">B</span>–<span style="color: #4263FF">C</span>:</td>
    <td style="text-align:right">{{ distanceBC.toFixed(5) }}</td></tr>
    <tr v-if="distanceAC > 0">
    <td>Distance <span style="color: #FF0000">A</span>–<span style="color: #4263FF">C</span>:</td>
    <td style="text-align:right">{{ distanceAC.toFixed(5) }}</td></tr>
    <tr v-if="angleABC >= 0">
    <!-- eslint-disable-next-line @alasdair/max-len/max-len -->
    <td>Angle <span style="color: #FF0000">A</span>–<span style="color: #00C300">B</span>–<span style="color: #4263FF">C</span>:</td>
    <td style="text-align:right">{{ angleABC.toFixed(5) }}</td></tr>
  </v-table>
  <v-table v-if="volume > 0" density="default" class="pa-1 mt-n1 pr-5">
    <tr><td style="width:9rem">Polyhedral volume:</td><td style="text-align:right">{{ volume.toFixed(5) }}</td></tr>
  </v-table>
  <v-btn class="mt-4 mb-4" block @click="controlStore.deselectAll()">Deselect</v-btn>
</v-container>
</template>
