<script setup lang="ts">
/**
 * @component
 * Controls for the X-Ray diffraction pattern computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-04
 */
import {ref, watch} from "vue";
import {showAlertMessage} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

const wavelengthCodes = ref<string[]>([]);
const wavelengthCode = ref("");
const wavelengthNumeric = ref(1.5);
const theta = ref([0, 90]);
const scaled = ref<boolean|null>(true);
const enableComputation = ref(false);
const width = ref(0.25);
const showHKL = ref<boolean|null>(false);

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        enableComputation.value = params.enableComputation as boolean ?? false;
        scaled.value = params.scaled as boolean ?? true;
        theta.value[0] = params.thetaLow as number ?? 0;
        theta.value[1] = params.thetaHigh as number ?? 90;
        width.value = params.width as number ?? 0.25;
		showHKL.value = params.showHKL as boolean ?? false;
        const codes = params.wavelengthCodes as string[] ?? [];
        wavelengthCodes.value.length = 0;
        for(const code of codes) wavelengthCodes.value.push(code);
        wavelengthCodes.value.push("Manual");
        wavelengthCode.value = params.wavelengthCode as string ?? "CuKa";
        wavelengthNumeric.value = params.wavelengthNumeric as number ?? 1.5;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

/** Changing computation parameters */
watch([wavelengthCode, wavelengthNumeric, theta, scaled], () => {

    sendToNode(id, "compute", {
        wavelengthCode: wavelengthCode.value,
        wavelengthNumeric: wavelengthNumeric.value,
        thetaLow: theta.value[0],
        thetaHigh: theta.value[1],
        scaled: scaled.value!,
        width: width.value,
        showHKL: showHKL.value!
    });
}, {deep: true});

/** Changing charting parameters */
watch([width, showHKL], () => {

    sendToNode(id, "show", {
        width: width.value,
        showHKL: showHKL.value!
    });
});

/** Receive if a structure has been loaded */
receiveFromNode(id, "enable", (params: CtrlParams) => {
    enableComputation.value = params.enableComputation as boolean ?? false;
});

/**
 * Open the chart window
 */
const openChartWindow = (): void => {

    sendToNode(id, "open", {
        wavelengthCode: wavelengthCode.value,
        wavelengthNumeric: wavelengthNumeric.value,
        thetaLow: theta.value[0],
        thetaHigh: theta.value[1],
        scaled: scaled.value!,
        width: width.value,
        showHKL: showHKL.value!
    });
};

</script>


<template>
<v-container class="container">
  <v-select v-model="wavelengthCode" :items="wavelengthCodes" class="ml-2 mt-2 mb-4"
            label="Wavelength"/>
  <v-number-input v-if="wavelengthCode === 'Manual'" v-model="wavelengthNumeric"
                  label="Numeric wavelength" :precision="6"
                  :min="0.1" :max="4" :step="0.1" class="ml-2 mr-0" />
  <g-debounced-range-slider v-slot="{values}" v-model="theta"
                              :step="0.01" :min="0" :max="90"
                              class="ml-4 mt-2 pr-4">
    <v-label :text="`Two theta range (${values[0].toFixed(2)} – ${values[1].toFixed(2)})`"
             class="ml-n2 no-select"/>
  </g-debounced-range-slider>
  <v-switch v-model="scaled" label="Chart scaled" class="ml-2" />
  <v-switch v-model="showHKL" label="Show HKL" class="ml-2 mb-6" />
  <g-debounced-slider v-slot="{value}" v-model="width" :min="0" :max="5" :step="0.05"
                      class="ml-2 mb-6 mt-1">
    <v-label :text="`Peak width (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
  <v-btn block @click="openChartWindow" :disabled="!enableComputation">Open chart</v-btn>
</v-container>
</template>
