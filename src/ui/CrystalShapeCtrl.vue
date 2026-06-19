<script setup lang="ts">
/**
 * @component
 * Controls for the computation of the crystal shape for a given structure.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-09
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {onUnmounted, reactive, ref, toRaw, watch} from "vue";

import NodeAlert from "@/widgets/NodeAlert.vue";
import BlockButton from "@/widgets/BlockButton.vue";
import DebouncedSlider from "@/widgets/DebouncedSlider.vue";

// > Persistent state that is saved in the project file
const state = reactive({
    allPlanes: false,
    maxPlanesCount: 80,
    processParallelism: false
});

// > Local variables
const computingShapeRunning = ref(false);
const stepMessage = ref("");

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// > Initialize the ui
resetNodeAlert();
askNode(id, "init")
    .then((params) => {
        state.allPlanes = params.allPlanes as boolean ?? false;
        state.maxPlanesCount = params.maxPlanesCount as number ?? 80;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                      "crystalShape");
    });

/** Receive the current step description */
receiveFromNode(id, "step", (params) => {

    stepMessage.value = params.message as string ?? "";
});

// > Computation
/**
 * Start the computation
 */
const computeShape = (): void => {

    computingShapeRunning.value = true;
    askNode(id, "compute")
    .then((response) => {
        if(response.error) throw Error(response.error as string);
    })
    .catch((error: Error) => {
        showNodeAlert(`Error computing crystal shape: ${error.message}`,
                      "crystalShape");
    })
    .finally(() => {
        computingShapeRunning.value = false;
    });
};

/** Send to main process changes in the status */
const stopWatcher = watch(state, (st) => {

    // Pass state changes to the main process for saving in the project file
    sendToNode(id, "state", toRaw(st));
});

// Cleanup
onUnmounted(() => {
    stopWatcher();
});

</script>


<template>
<v-container class="container pb-8">
  <v-switch v-model="state.allPlanes"
            label="Use all HKL planes" class="ml-1 mb-4 mt-4" />
  <debounced-slider v-slot="{value}" v-model="state.maxPlanesCount" :min="10" :max="729" :step="1"
                      class="ml-1 mb-2" :disabled="state.allPlanes">
    <v-label :text="`Max HKL planes to use (${value.toFixed(0)})`" class="no-select" />
  </debounced-slider>
  <v-switch v-model="state.processParallelism" label="Multi process parallelism" class="ml-1 mb-4"/>

  <block-button label="Compute crystal shape"
                :loading="computingShapeRunning"
                @click="computeShape"/>

  <v-label :text="stepMessage" class="ml-1 mt-2 result-label" />

  <node-alert node="crystalShape" class="mt-1"/>

</v-container>
</template>
