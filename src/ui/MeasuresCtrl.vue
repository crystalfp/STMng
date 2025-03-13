<script setup lang="ts">
/**
 * @component
 * Controls for the measure atoms positions, distances and angles node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-09
 */

import {ref, watch, shallowRef} from "vue";
import {storeToRefs} from "pinia";
import {sm} from "@/services/SceneManager";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import {askNode, receiveFromNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {MeasuresRenderer} from "@/renderers/MeasuresRenderer";
import type {SelectedAtom, BondData} from "@/types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
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
const details    = shallowRef<SelectedAtom[]>([]);

const measurementType = ref<"atoms" | "polyhedra" | "bonds">("atoms");
const bondData = ref<BondData[]>([]);

/** Show fractional coordinates */
const useFractional = ref(false);

const renderer = new MeasuresRenderer(id);

// Watch atoms selection
watch(controlStore.atomsSelected, () => {

    // Check if atoms have been deselected
    const nselected = controlStore.atomsSelected.length;
    if(nselected === 0) {
        renderer.clearOutput();
        bondData.value.length = 0;
        details.value.length = 0;
        distanceAB.value = -1;
        return;
    }

    const pointSize = configStore.isPerspectiveCamera ? 0.3 : 6;
    const atsel = controlStore.atomsSelected;
    if(measurementType.value === "bonds") {

        askNode(id, "bonds", {
            idx: atsel[nselected-1]
        })
        .then((params) => {

            const bondDataTable = JSON.parse(params.labels as string ?? "[]") as BondData[];
            bondDataTable.sort((a, b) => a.idx - b.idx);
            bondData.value.length = 0;
            for(const bd of bondDataTable) bondData.value.push(bd);

            renderer.measureBonds(params, bondDataTable, pointSize);
        })
        .catch((error: Error) => showSystemAlert(`Error from computing bonds lengths: ${error.message}`));
        return;
    }

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

    	renderer.measureAtoms(details.value, pointSize);
    })
    .catch((error: Error) => showSystemAlert(`Error from computing measures: ${error.message}`));

}, {deep: true});

// Remove selection on structure change
receiveFromNode(id, "reset", () => {
    controlStore.deselectAll();
    renderer.clearOutput();
});

// Watch polyhedra selection
const {polyhedronNewIdx} = storeToRefs(controlStore);
watch(polyhedronNewIdx, () => {

    // No polyhedra selected
    if(controlStore.polyhedronNewIdx === undefined) return;

    renderer.selectPolyhedra(controlStore.polyhedronNewIdx, controlStore.polyhedronCurrentIdx);

    // Click on the same poly deselects it
    if(controlStore.polyhedronNewIdx === controlStore.polyhedronCurrentIdx) {

        renderer.setCurrentPolyhedraColor(controlStore.polyhedronCurrentColor);

        controlStore.polyhedronCurrentIdx = undefined;
        controlStore.polyhedronNewIdx = undefined;

        volume.value = -1;
    }
    else {
        // Deselect current selection
        if(controlStore.polyhedronCurrentIdx !== undefined) {

            renderer.setCurrentPolyhedraColor(controlStore.polyhedronCurrentColor);

            controlStore.polyhedronCurrentIdx = undefined;
        }

        // Select new poly
        renderer.markPolyhedra();

        // Move the control to the new poly
        controlStore.polyhedronCurrentIdx = controlStore.polyhedronNewIdx;
        controlStore.polyhedronCurrentColor = controlStore.polyhedronNewColor;
        controlStore.polyhedronNewIdx = undefined;

        volume.value = renderer.getPolyhedraVolume();
    }
    sm.modified();
});

// Watch measurement change. Every measurement should start with nothing selected
watch(measurementType, () => controlStore.deselectAll());

/**
 * Format one coordinate (cartesian or fractional) of the selected atom.
 *
 * @param detail - Selected atom details
 * @param idx - Coordinate index to visualize
 * @returns Formatted atom coordinates (cartesian or fractional)
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
  <v-label class="ml-2 mb-1 mt-4 no-select">Measurement type</v-label>
  <v-btn-toggle v-model="measurementType" mandatory class="ml-2 mb-6">
    <v-btn value="atoms">Atoms</v-btn>
    <v-btn value="polyhedra">Polyhedra</v-btn>
    <v-btn value="bonds">Bonds</v-btn>
  </v-btn-toggle>

  <v-container v-if="measurementType === 'atoms'" class="pa-0">
    <v-switch v-model="useFractional" label="Show fractional coordinates"
              class="ml-4"/>
    <v-label v-if="details.length > 0"
             class="simple-title mb-2">Selected atoms</v-label>
    <v-table v-if="details.length > 0" density="default" class="pa-1 pr-5">
      <tr v-for="line of details" :key="line.index">
        <td :style="`color:${line.color};width:3rem`">{{ line.label }}</td>
        <td class="w-1">{{ line.symbol }}</td>
        <td class="w-3 right">[</td>
        <td class="w-1 right">{{ `${showCoords(line, 0)},` }}</td>
        <td class="w-2 right">{{ `${showCoords(line, 1)},` }}</td>
        <td class="w-2 right">{{ `${showCoords(line, 2)}` }}</td>
        <td class="w-0-5 right">]</td>
      </tr>
    </v-table>
    <v-label v-if="distanceAB > 0" class="simple-title mb-2 mt-2">Measures</v-label>
    <v-table v-if="distanceAB > 0" density="default" class="pa-1 pr-5">
      <tr>
      <td class="w-9">Distance <span class="red">A</span>–<span class="green">B</span>:</td>
      <td class="right">{{ distanceAB.toFixed(5) }}</td></tr>
      <tr v-if="distanceBC > 0">
      <td>Distance <span class="green">B</span>–<span class="blue">C</span>:</td>
      <td class="right">{{ distanceBC.toFixed(5) }}</td></tr>
      <tr v-if="distanceAC > 0">
      <td>Distance <span class="red">A</span>–<span class="blue">C</span>:</td>
      <td class="right">{{ distanceAC.toFixed(5) }}</td></tr>
      <tr v-if="angleABC >= 0">
      <td>Angle <span class="red">A</span>–<span class="green">B</span>–<span class="blue">C</span>:</td>
      <td class="right">{{ angleABC.toFixed(5) }}</td></tr>
    </v-table>
  </v-container>

  <v-container v-if="measurementType === 'polyhedra' && volume > 0" class="pa-0">
    <v-label class="simple-title mb-3">Measure</v-label>
    <v-table density="default" class="pa-1 pr-5">
      <tr><td class="w-9">Polyhedral volume:</td><td class="right">{{ volume.toFixed(5) }}</td></tr>
    </v-table>
  </v-container>

  <v-container v-if="measurementType === 'bonds' && bondData.length > 0" class="pa-0">
    <v-label class="simple-title mb-3">Bond length to atom index</v-label>
    <v-table density="default" class="pa-1 pr-5">
      <tr v-for="entry of bondData" :key="entry.idx">
        <td class="w-9">{{ entry.idx }}</td>
        <td class="right">{{ entry.distance.toFixed(5) }}</td></tr>
    </v-table>
  </v-container>

  <v-btn class="mt-4 mb-4" block @click="controlStore.deselectAll()">Deselect</v-btn>
</v-container>
</template>


<style scoped>
.green {
  color: #00C300
}

.red {
  color: #FF0000
}

.blue {
  color: #4263FF
}

.right {
  text-align: right
}

.w-0-5 {
  width: 0.5rem
}

.w-1 {
  width: 1rem
}

.w-2 {
  width: 2rem
}

.w-3 {
  width: 3rem
}

.w-9 {
  width: 9rem
}
</style>
