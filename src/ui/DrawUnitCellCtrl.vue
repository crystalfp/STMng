<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {mdiRectangle, mdiRestore} from "@mdi/js";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Unit cell
const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);
const lineColorShow = ref(false);

// Supercell
const repetitionsA = ref(1);
const repetitionsB = ref(1);
const repetitionsC = ref(1);
const showSupercell = ref(false);
const supercellColor = ref("#16a004");
const dashedSupercell = ref(false);
const supercellColorShow = ref(false);

const hasSupercell = (): boolean => {
    return repetitionsA.value > 1 || repetitionsB.value > 1 || repetitionsC.value > 1;
};

sb.getUiParams(props.id, (params: UiParams) => {
    showUnitCell.value = params.showUnitCell as boolean ?? true;
    lineColor.value = params.lineColor as string ?? "#0000FF";
    dashedLine.value = params.dashedLine as boolean ?? false;

    repetitionsA.value = params.repetitionsA as number ?? 1;
    repetitionsB.value = params.repetitionsB as number ?? 1;
    repetitionsC.value = params.repetitionsC as number ?? 1;
    showSupercell.value = params.showSupercell as boolean ?? hasSupercell();
    supercellColor.value = params.supercellColor as string ?? "#16a004";
    dashedSupercell.value = params.dashedSupercell as boolean ?? false;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showUnitCell: showUnitCell.value,
        lineColor: lineColor.value,
        dashedLine: dashedLine.value,
        repetitionsA: repetitionsA.value,
        repetitionsB: repetitionsB.value,
        repetitionsC: repetitionsC.value,
        showSupercell: showSupercell.value,
        supercellColor: supercellColor.value,
        dashedSupercell: dashedSupercell.value
    });
});

const resetSliders = (): void => {
    repetitionsA.value = 1;
    repetitionsB.value = 1;
    repetitionsC.value = 1;
    showSupercell.value = false;
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" color="primary" label="Show unit cell" class="mt-4 ml-4" />
  <v-switch v-model="dashedLine" color="primary" label="Dashed lines" class="ml-4 mt-n5" />
  <v-btn class="mb-6 ml-2 w-50" @click="lineColorShow = !lineColorShow">
    <template #append>
      <v-icon :icon="mdiRectangle" :color="lineColor" size="x-large" />
    </template>
    Line color
  </v-btn><br>
  <v-color-picker v-if="lineColorShow" v-model="lineColor" :modes="['rgb', 'hsl', 'hex']"
                  elevation="0" class="mb-4 ml-2" />
  <v-divider :thickness="8" class="mb-4" />
  <v-label text="Cell repetitions" class="ml-2 mb-3" />
  <v-slider v-model="repetitionsA" label="Along a" min="1" max="10" step="1" thumb-label
            show-ticks="always" tick-size="2" />
  <v-slider v-model="repetitionsB" label="Along b" min="1" max="10" step="1" thumb-label
            show-ticks="always" tick-size="2" />
  <v-slider v-model="repetitionsC" label="Along c" min="1" max="10" step="1" thumb-label
            show-ticks="always" tick-size="2" />
  <v-btn :disabled="!hasSupercell()" class="mb-4 ml-2 w-50" @click="resetSliders">
    <template #append>
      <v-icon :icon="mdiRestore" size="x-large" />
    </template>
    Reset
  </v-btn>
  <v-switch v-model="showSupercell" color="primary" :disabled="!hasSupercell()" label="Show supercell" class="ml-4" />
  <v-switch v-model="dashedSupercell" color="primary" label="Dashed lines supercell" class="ml-4 mt-n5" />
  <v-btn class="mb-6 ml-2 w-50" @click="supercellColorShow = !supercellColorShow">
    <template #append>
      <v-icon :icon="mdiRectangle" :color="supercellColor" size="x-large" />
    </template>
    Line color
  </v-btn><br>
  <v-color-picker v-if="supercellColorShow" v-model="supercellColor" :modes="['rgb', 'hsl', 'hex']"
                  elevation="0" class="mb-4 ml-2" />
</v-container>
</template>
