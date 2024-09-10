<script setup lang="ts">
/**
 * @component
 * Controls for the atoms' trajectories visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watchEffect, watch} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "../stores/controlStore";
import {askNode, sendToNode} from "../services/RoutesClient";
import {showAlertMessage} from "../services/AlertMessage";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasTrajectory = true;

const showTrajectories = ref(false);
const labelKind = ref("symbol");
const atomsSelector = ref("");
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);
const positionCloudsGrow = ref(0.1);
const positionCloudsSideExp = ref(5);

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showTrajectories.value      = params.showTrajectories as boolean ?? false;
        labelKind.value             = params.labelKind as string ?? "symbol";
        atomsSelector.value         = params.atomsSelector as string ?? "";
        maxDisplacement.value       = params.maxDisplacement as number ?? 1;
        showPositionClouds.value    = params.showPositionClouds as boolean ?? false;
        positionCloudsSideExp.value = params.positionCloudsSideExp as number ?? 5;
        positionCloudsGrow.value    = params.positionCloudsGrow as number ?? 0.1;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for Trajectories: ${error.message}`));

watchEffect(() => {

/*    sb.setUiParams(id, {
        showTrajectories: showTrajectories.value,
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
        maxDisplacement: maxDisplacement.value,
        showPositionClouds: showPositionClouds.value,
        positionCloudsSideExp: positionCloudsSideExp.value,
        positionCloudsGrow: positionCloudsGrow.value,
    });*/
});

/**
 * Convert the exponent to the power of 2
 *
 * @param value - Exponent
 */
const showPowerOf2 = (value: number): string => (2**value).toFixed(0);

/**
 * Clear the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
};

const {trajectoriesRecording} = storeToRefs(controlStore);

watch(trajectoriesRecording, () => {

    sendToNode(id, "run", {
        run: controlStore.trajectoriesRecording
    });
});

const toggleRecording = (): void => {

    controlStore.trajectoriesRecording = !controlStore.trajectoriesRecording;
};

</script>


<template>
<v-container class="container">
  <v-switch v-model="showTrajectories" color="primary" label="Show trajectories"
            density="compact" class="mt-2 ml-2" />
  <v-btn block class="mb-6" @click="resetAccumulator">Clear trajectories</v-btn>
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    title="Select traced atoms by" placeholder="Traced atoms selector" />
  <g-debounced-slider v-slot="{value}" v-model="maxDisplacement"
                      :step="0.01" :min="0.01" :max="3" class="ml-1 my-4">
    <v-label :text="`Max displacement (${value})`" />
  </g-debounced-slider>
  <v-switch v-model="showPositionClouds" color="primary" label="Show position clouds"
            density="compact" class="ml-2" />
  <v-container v-if="showPositionClouds" class="pa-0">
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsSideExp"
                        :step="1" :min="3" :max="10" class="ml-1">
      <v-label :text="`Cloud volume subdivisions (${showPowerOf2(value)})`" />
    </g-debounced-slider>
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsGrow"
                        :step="0.1" :min="0" :max="1" class="ml-1 my-4">
      <v-label :text="`Enlarge volume (${value*100}%)`" />
    </g-debounced-slider>
  </v-container>
  <v-btn block :disabled="atomsSelector.trim() === '' && labelKind !== 'all'"
    @click="toggleRecording">
    {{ controlStore.trajectoriesRecording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
