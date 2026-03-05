<script setup lang="ts">
/**
 * @component
 * Controls for the unit cell / supercell visualization.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {onUnmounted, ref, watch} from "vue";
import {askNode, receiveVerticesFromNode, sendToNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {DrawUnitCellRenderer} from "@/renderers/DrawUnitCellRenderer";

import ColorSelector from "@/widgets/ColorSelector.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import BlockButton from "@/widgets/BlockButton.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Base size for fat lines
const BASE = 0.05;
// Small radius increment for unit cell to cover the supercell lines
const INCREMENT = 0.005;

// Unit cell
const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);
const showBasisVectors = ref(false);
const lineWidth = ref(0);
const showLineWidth = ref(0);

// Supercell
const repetitionsA = ref(1);
const repetitionsB = ref(1);
const repetitionsC = ref(1);
const showSupercell = ref(false);
const supercellColor = ref("#16A004");
const dashedSupercell = ref(false);

const showRepetitionsA = ref(1);
const showRepetitionsB = ref(1);
const showRepetitionsC = ref(1);

// Adjust origin
const percentA = ref(0);
const percentB = ref(0);
const percentC = ref(0);
const shrink   = ref(false);

const showPercentA = ref(0);
const showPercentB = ref(0);
const showPercentC = ref(0);

// Saved vertices
const verticesUC = Array<number>(24);
const verticesSC = Array<number>(24);
const verticesBV: number[] = [];

/**
 * Check if a supercell has been requested
 *
 * @returns True if there is at least one repetition
 */
const hasSupercell = (): boolean => repetitionsA.value > 1 ||
                                    repetitionsB.value > 1 ||
                                    repetitionsC.value > 1;

// > Initialize ui
askNode(id, "init")
    .then((params) => {

        repetitionsA.value = params.repetitionsA as number ?? 1;
        repetitionsB.value = params.repetitionsB as number ?? 1;
        repetitionsC.value = params.repetitionsC as number ?? 1;
        lineColor.value = params.lineColor as string ?? "#0000FF";
        showBasisVectors.value = params.showBasisVectors as boolean ?? false;
        dashedLine.value = params.dashedLine as boolean ?? false;
        showUnitCell.value = params.showUnitCell as boolean ?? true;
        showSupercell.value = params.showSupercell as boolean ?? hasSupercell();
        supercellColor.value = params.supercellColor as string ?? "#16A004";
        dashedSupercell.value = params.dashedSupercell as boolean ?? false;
        lineWidth.value = params.lineWidth as number ?? 0;

        percentA.value = params.percentA as number ?? 0;
        percentB.value = params.percentB as number ?? 0;
        percentC.value = params.percentC as number ?? 0;
        shrink.value = params.shrink as boolean ?? false;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

// > Initialize graphical rendering
const renderer = new DrawUnitCellRenderer(id);

// Render the unit cell
receiveVerticesFromNode(id, "cell", (vertices: number[]) => {

    if(lineWidth.value === 0) {
        renderer.drawCell(vertices, lineColor.value, dashedLine.value,
                          showUnitCell.value, false);
    }
    else {
        renderer.drawFatCell(vertices, lineColor.value, showUnitCell.value,
                             lineWidth.value*BASE+INCREMENT, false);
    }
    for(let i=0; i < 24; ++i) verticesUC[i] = vertices[i];
});

// Render the supercell
receiveVerticesFromNode(id, "supercell", (vertices: number[]) => {

    if(lineWidth.value === 0) {
        renderer.drawCell(vertices, supercellColor.value, dashedSupercell.value,
                          showSupercell.value, true);
    }
    else {
        renderer.drawFatCell(vertices, supercellColor.value, showSupercell.value,
                             lineWidth.value*BASE, true);
    }
    for(let i=0; i < 24; ++i) verticesSC[i] = vertices[i];
});

// Render the basis vectors
receiveVerticesFromNode(id, "vectors", (vertices: number[]) => {

    const width = lineWidth.value ? lineWidth.value*BASE+2*INCREMENT : 0;
	renderer.drawBasisVectors(showBasisVectors.value, width, vertices);
    verticesBV.length = 12;
    for(let i=0; i < 12; ++i) verticesBV[i] = vertices[i];
});

/**
 * Reset repetition sliders to default values
 */
const resetSliders = (): void => {

    repetitionsA.value = 1;
    repetitionsB.value = 1;
    repetitionsC.value = 1;
    showSupercell.value = false;

    showRepetitionsA.value = 1;
    showRepetitionsB.value = 1;
    showRepetitionsC.value = 1;
};

const stopWatcher1 = watch([showUnitCell, showSupercell, showBasisVectors], () => {

    renderer.setVisibility(showUnitCell.value, showSupercell.value, showBasisVectors.value);

    sendToNode(id, "visible", {
        showUnitCell: showUnitCell.value,
        showSupercell: showSupercell.value,
        showBasisVectors: showBasisVectors.value
    });
});

const stopWatcher2 = watch([repetitionsA, repetitionsB, repetitionsC], () => {

    showSupercell.value = hasSupercell();
    sendToNode(id, "repeat", {
        repetitionsA: repetitionsA.value,
        repetitionsB: repetitionsB.value,
        repetitionsC: repetitionsC.value
    });
});

const stopWatcher3 = watch([dashedLine, lineColor, dashedSupercell, supercellColor], () => {

    renderer.changeMaterials(lineColor.value, dashedLine.value,
                             supercellColor.value, dashedSupercell.value);

    sendToNode(id, "appear", {
		dashedLine: dashedLine.value,
		lineColor: lineColor.value,
        supercellColor: supercellColor.value,
        dashedSupercell: dashedSupercell.value,
   });
});

const stopWatcher4 = watch([percentA, percentB, percentC, shrink], () => {

    sendToNode(id, "origin", {
        percentA: percentA.value,
        percentB: percentB.value,
        percentC: percentC.value,
        shrink: shrink.value
    });
});

const stopWatcher5 = watch([lineWidth, showBasisVectors], ([afterLw, afterSbv]) => {

    if(afterLw > 0) {
        renderer.drawFatCell(verticesUC, lineColor.value, showUnitCell.value,
                             afterLw*BASE+INCREMENT, false);
        renderer.drawFatCell(verticesSC, supercellColor.value, showSupercell.value,
                             afterLw*BASE, true);

    	renderer.drawBasisVectors(afterSbv,
                                  afterLw*BASE+2*INCREMENT, verticesBV);
    }
    else {
        renderer.drawCell(verticesUC, lineColor.value, dashedLine.value,
                          showUnitCell.value, false);
        renderer.drawCell(verticesSC, supercellColor.value, dashedSupercell.value,
                          showSupercell.value, true);
    	renderer.drawBasisVectors(afterSbv, 0, verticesBV);
    }
});

/**
 * Reset shift sliders to default values
 */
const resetShift = (): void => {

    percentA.value = 0;
    percentB.value = 0;
    percentC.value = 0;
    shrink.value = false;
};

/**
 * Check if there is no shift
 */
const noShift = (): boolean => percentA.value === 0 && percentB.value === 0 && percentC.value === 0;

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
    stopWatcher3();
    stopWatcher4();
    stopWatcher5();
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" label="Show unit cell" class="mt-4 ml-2" />
  <v-switch v-model="dashedLine" :disabled="lineWidth > 0" label="Dashed lines" class="ml-2" />
  <v-switch v-model="showBasisVectors" label="Show basis vectors" class="ml-2" />
  <slider-with-steppers v-model="lineWidth" v-model:raw="showLineWidth"
                          :label="`Line width (${showLineWidth})`" label-width="7rem"
                          :min="0" :max="3" :step="1" class="mb-2 ml-1"/>
  <color-selector v-model="lineColor" label="Line color" />
  <v-label class="separator-title">Cell repetitions</v-label>
  <slider-with-steppers v-model="repetitionsA" v-model:raw="showRepetitionsA"
                          :label="`Along a (${showRepetitionsA})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" class="ml-1"/>
  <slider-with-steppers v-model="repetitionsB" v-model:raw="showRepetitionsB"
                          :label="`Along b (${showRepetitionsB})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" class="ml-1" />
  <slider-with-steppers v-model="repetitionsC" v-model:raw="showRepetitionsC"
                          :label="`Along c (${showRepetitionsC})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" class="ml-1" />
  <block-button :disabled="!hasSupercell()" class="mt-2" label="Reset" @click="resetSliders" />
  <v-switch v-model="showSupercell" :disabled="!hasSupercell()"
            label="Show supercell" class="ml-2" />
  <v-switch v-model="dashedSupercell" :disabled="!hasSupercell() || lineWidth > 0"
            label="Dashed lines supercell" class="ml-2 mb-4" />
  <color-selector v-model="supercellColor" label="Line color" />
  <v-label class="separator-title">Shift origin</v-label>
  <slider-with-steppers v-model="percentA" v-model:raw="showPercentA"
                          :label="`Along a (${showPercentA}%)`" label-width="7.2rem"
                          :min="-50" :max="50" :step="1" class="ml-1" />
  <slider-with-steppers v-model="percentB" v-model:raw="showPercentB"
                          :label="`Along b (${showPercentB}%)`" label-width="7.2rem"
                          :min="-50" :max="50" :step="1" class="ml-1" />
  <slider-with-steppers v-model="percentC" v-model:raw="showPercentC"
                          :label="`Along c (${showPercentC}%)`" label-width="7.2rem"
                          :min="-50" :max="50" :step="1" class="ml-1" />
  <v-switch v-model="shrink" label="Shrink cell" class="ml-2 my-2" />
  <block-button :disabled="noShift()" class="mt-2 mb-4" label="Reset" @click="resetShift" />

</v-container>
</template>
