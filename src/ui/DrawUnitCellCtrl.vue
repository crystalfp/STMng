<script setup lang="ts">
/**
 * @component
 * Controls for the unit cell / supercell visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watch} from "vue";
import {askNode, receiveVerticesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {DrawUnitCellRenderer} from "@/renderers/DrawUnitCellRenderer";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Unit cell
const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);
const showBasisVectors = ref(false);

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
const shrink   = ref(true);

const showPercentA = ref(0);
const showPercentB = ref(0);
const showPercentC = ref(0);

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

        percentA.value = params.percentA as number ?? 0;
        percentB.value = params.percentB as number ?? 0;
        percentC.value = params.percentC as number ?? 0;
        shrink.value = params.shrink as boolean ?? true;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new DrawUnitCellRenderer(id);

// Render the unit cell
receiveVerticesFromNode(id, "cell", (vertices: number[]) => {

    renderer.drawCell(vertices, lineColor.value, dashedLine.value, showUnitCell.value, false);
});

// Render the supercell
receiveVerticesFromNode(id, "supercell", (vertices: number[]) => {

    renderer.drawCell(vertices, supercellColor.value, dashedSupercell.value, showSupercell.value, true);
});

// Render the basis vectors
receiveVerticesFromNode(id, "vectors", (vertices: number[]) => {

	renderer.drawBasisVectors(vertices, showBasisVectors.value);
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

watch([showUnitCell, showSupercell, showBasisVectors], () => {

    renderer.setVisibility(showUnitCell.value, showSupercell.value, showBasisVectors.value);

    sendToNode(id, "visible", {
        showUnitCell: showUnitCell.value,
        showSupercell: showSupercell.value,
        showBasisVectors: showBasisVectors.value
    });
});

watch([repetitionsA, repetitionsB, repetitionsC], () => {

    showSupercell.value = hasSupercell();
    sendToNode(id, "repeat", {
        repetitionsA: repetitionsA.value,
        repetitionsB: repetitionsB.value,
        repetitionsC: repetitionsC.value
    });
});

watch([dashedLine, lineColor, dashedSupercell, supercellColor], () => {

    renderer.changeMaterials(lineColor.value, dashedLine.value,
                             supercellColor.value, dashedSupercell.value);

    sendToNode(id, "appear", {
		dashedLine: dashedLine.value,
		lineColor: lineColor.value,
        supercellColor: supercellColor.value,
        dashedSupercell: dashedSupercell.value,
   });
});

watch([percentA, percentB, percentC, shrink], () => {

    sendToNode(id, "origin", {
        percentA: percentA.value,
        percentB: percentB.value,
        percentC: percentC.value,
        shrink: shrink.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" label="Show unit cell" class="mt-2 ml-4" />
  <v-switch v-model="dashedLine" label="Dashed lines" class="ml-4 mt-n5" />
  <v-switch v-model="showBasisVectors" label="Show basis vectors" class="ml-4 mt-n5" />
  <g-color-selector v-model="lineColor" label="Line color" block />
  <v-label class="separator-title">Cell repetitions</v-label>
  <g-slider-with-steppers v-model="repetitionsA" v-model:raw="showRepetitionsA"
                          :label="`Along a (${showRepetitionsA})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsB" v-model:raw="showRepetitionsB"
                          :label="`Along b (${showRepetitionsB})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsC" v-model:raw="showRepetitionsC"
                          :label="`Along c (${showRepetitionsC})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <v-btn :disabled="!hasSupercell()" class="mt-2 mb-4 ml-2 w-100"
         @click="resetSliders">
    Reset
  </v-btn>
  <v-switch v-model="showSupercell" :disabled="!hasSupercell()"
            label="Show supercell" class="ml-4" />
  <v-switch v-model="dashedSupercell" :disabled="!hasSupercell()"
            label="Dashed lines supercell" class="ml-4 mt-n5" />
  <g-color-selector v-model="supercellColor" label="Line color" block />
  <v-label class="separator-title">Shift origin</v-label>
  <g-slider-with-steppers v-model="percentA" v-model:raw="showPercentA"
                          :label="`Along a (${showPercentA}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentB" v-model:raw="showPercentB"
                          :label="`Along b (${showPercentB}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentC" v-model:raw="showPercentC"
                          :label="`Along c (${showPercentC}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <v-switch v-model="shrink" label="Shrink cell" class="ml-4 mt-2" />

</v-container>
</template>
