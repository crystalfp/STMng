<script setup lang="ts">
/**
 * @component
 * Controls for the unit cell / supercell visualization.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
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
 * @returns True if there is a repetition
 */
const hasSupercell = (): boolean => repetitionsA.value > 1 || repetitionsB.value > 1 || repetitionsC.value > 1;

sb.getUiParams(props.id, (params: UiParams) => {
    showUnitCell.value = params.showUnitCell as boolean ?? true;
    lineColor.value = params.lineColor as string ?? "#0000FF";
    dashedLine.value = params.dashedLine as boolean ?? false;
    showBasisVectors.value = params.showBasisVectors as boolean ?? false;

    repetitionsA.value = params.repetitionsA as number ?? 1;
    repetitionsB.value = params.repetitionsB as number ?? 1;
    repetitionsC.value = params.repetitionsC as number ?? 1;
    showSupercell.value = params.showSupercell as boolean ?? hasSupercell();
    supercellColor.value = params.supercellColor as string ?? "#16A004";
    dashedSupercell.value = params.dashedSupercell as boolean ?? false;

    percentA.value = params.percentA as number ?? 0;
    percentB.value = params.percentB as number ?? 0;
    percentC.value = params.percentC as number ?? 0;
    shrink.value = params.shrink as boolean ?? true;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showUnitCell: showUnitCell.value,
        lineColor: lineColor.value,
        dashedLine: dashedLine.value,
        showBasisVectors: showBasisVectors.value,
        repetitionsA: repetitionsA.value,
        repetitionsB: repetitionsB.value,
        repetitionsC: repetitionsC.value,
        showSupercell: showSupercell.value,
        supercellColor: supercellColor.value,
        dashedSupercell: dashedSupercell.value,
        percentA: percentA.value,
        percentB: percentB.value,
        percentC: percentC.value,
        shrink: shrink.value,
    });
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

</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" color="primary" label="Show unit cell" class="mt-2 ml-4" />
  <v-switch v-model="dashedLine" color="primary" label="Dashed lines" class="ml-4 mt-n5" />
  <v-switch v-model="showBasisVectors" color="primary" label="Show basis vectors" class="ml-4 mt-n5" />
  <g-color-selector v-model="lineColor" label="Line color" />
  <v-divider thickness="8" class="mb-4" />
  <v-label text="Cell repetitions" class="ml-2 mb-1 yellow-title" />
  <g-slider-with-steppers v-model="repetitionsA" v-model:raw="showRepetitionsA"
                          :label="`Along a (${showRepetitionsA})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsB" v-model:raw="showRepetitionsB"
                          :label="`Along b (${showRepetitionsB})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsC" v-model:raw="showRepetitionsC"
                          :label="`Along c (${showRepetitionsC})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <v-btn :disabled="!hasSupercell()" class="mt-2 mb-4 ml-2 w-50" @click="resetSliders">
    Reset
  </v-btn>
  <v-switch v-model="showSupercell" color="primary" :disabled="!hasSupercell()" label="Show supercell" class="ml-4" />
  <v-switch v-model="dashedSupercell" color="primary" label="Dashed lines supercell" class="ml-4 mt-n5" />
  <g-color-selector v-model="supercellColor" label="Line color" />
  <v-divider thickness="8" class="mb-4" />
  <v-label text="Shift origin (by fraction of basis)" class="ml-2 mb-3 yellow-title" />
  <g-slider-with-steppers v-model="percentA" v-model:raw="showPercentA"
                          :label="`Along a (${showPercentA}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentB" v-model:raw="showPercentB"
                          :label="`Along b (${showPercentB}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentC" v-model:raw="showPercentC"
                          :label="`Along c (${showPercentC}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <v-switch v-model="shrink" color="primary" label="Shrink cell" class="ml-4 mt-2" />

</v-container>
</template>
