<script setup lang="ts">
/**
 * @component
 * Controls for the X-Ray diffraction pattern computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-04
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
import {ref, reactive, watchEffect, onUnmounted} from "vue";
import {showSystemAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import DebouncedRangeSlider from "@/widgets/DebouncedRangeSlider.vue";
import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import ThrottledButton from "@/widgets/ThrottledButton.vue";

/** List of codes for the v-select widget */
interface WavelengthCodes {
    /** Label that appears on the selector */
    title?: string;
    /** Type of the special entries */
    type?: string;
    /** Value returned by the selector */
    value?: string;
}

const wavelengthCodes = reactive<WavelengthCodes[]>([]);
const enableComputation = ref(false);

// > Persistent state that is saved in the project file
// Except thetaLow and thetaHigh that are combined in the theta variable
const state = reactive({
    scaled: true,
    width: 0.75,
    wavelengthCode: "CuKa",
    wavelengthNumeric: 1.5,
    showHKL: false
});
const theta = ref([0, 90]);

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
        state.scaled = params.scaled as boolean ?? true;
        theta.value[0] = params.thetaLow as number ?? 0;
        theta.value[1] = params.thetaHigh as number ?? 90;
        state.width = params.width as number ?? 0.25;
		state.showHKL = params.showHKL as boolean ?? false;
        const codes = params.wavelengthCodes as string[] ?? [];
        wavelengthCodes.length = 0;
        for(const code of codes) wavelengthCodes.push({title: code, value: code});
        wavelengthCodes.push({type:  "divider"}, {title: "Manual", value: "Manual"});
        state.wavelengthCode = params.wavelengthCode as string ?? "CuKa";
        state.wavelengthNumeric = params.wavelengthNumeric as number ?? 1.5;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

/** Changing computation parameters */
const stopWatcher = watchEffect(() => {

    sendToNode(id, "compute", {
        wavelengthCode: state.wavelengthCode,
        wavelengthNumeric: state.wavelengthNumeric,
        thetaLow: theta.value[0],
        thetaHigh: theta.value[1],
        scaled: state.scaled,
        width: state.width,
        showHKL: state.showHKL
    });
});

// Cleanup
onUnmounted(() => {
    stopWatcher();
});

/** Receive if a structure has been loaded */
receiveFromNode(id, "enable", (params: CtrlParams) => {
    enableComputation.value = params.enableComputation as boolean ?? false;
});

</script>


<template>
<v-container class="container">
  <v-select v-model="state.wavelengthCode" :items="wavelengthCodes" class="my-4"
            label="Wavelength"/>
  <v-number-input v-if="state.wavelengthCode === 'Manual'" v-model="state.wavelengthNumeric"
                  label="Numeric wavelength" :precision="6"
                  :min="0.1" :max="4" :step="0.1" />
  <debounced-range-slider v-slot="{values}" v-model="theta"
                          :step="0.01" :min="0" :max="90"
                          class="ml-2 mt-2 pr-6">
    <v-label :text="`Two theta range (${values[0].toFixed(2)} – ${values[1].toFixed(2)})`"
             class="ml-n2 no-select"/>
  </debounced-range-slider>
  <v-switch v-model="state.scaled" label="Chart scaled" class="ml-3" />
  <v-switch v-model="state.showHKL" label="Show HKL" class="ml-3 mb-6" />
  <debounced-slider v-slot="{value}" v-model="state.width" :min="0" :max="5" :step="0.05"
                      class="ml-2 mb-6 mt-1">
    <v-label :text="`Peak width (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <throttled-button label="Open chart"
                    :disabled="!enableComputation"
                    @click="sendToNode(id, 'open')" />

</v-container>
</template>
