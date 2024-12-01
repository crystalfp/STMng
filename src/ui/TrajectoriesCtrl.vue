<script setup lang="ts">
/**
 * @component
 * Controls for the atoms' trajectories visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-12
 */

import {ref, watch} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "@/stores/controlStore";
import {askNode, receiveTracesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {TrajectoriesRenderer} from "@/renderers/TrajectoriesRenderer";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasTrajectory = true;

const showTrajectories = ref(false);
const labelKind = ref("symbol");
const atomsSelector = ref("");
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);
const positionCloudsSize = ref(100);
const positionCloudsColor = ref("#BBBBBE");

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showTrajectories.value      = params.showTrajectories as boolean ?? false;
        labelKind.value             = params.labelKind as string ?? "symbol";
        atomsSelector.value         = params.atomsSelector as string ?? "";
        maxDisplacement.value       = params.maxDisplacement as number ?? 1;
        showPositionClouds.value    = params.showPositionClouds as boolean ?? false;
		positionCloudsColor.value   = params.positionCloudsColor as string ?? "#BBBBBE";
		positionCloudsSize.value    = params.positionCloudsSize as number ?? 100;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`));

// > Initialize graphical rendering
const renderer = new TrajectoriesRenderer(id,
                                          showTrajectories.value,
                                          positionCloudsSize.value,
                                          positionCloudsColor.value);

/**
 * Clear the accumulated structures
 */
const resetTraces = (): void => {

    renderer.resetTraces();

    sendToNode(id, "reset");
};

/**
 * Toggle capturing trajectories
 */
const toggleRecording = (): void => {

    controlStore.trajectoriesRecording = !controlStore.trajectoriesRecording;
};

const {trajectoriesRecording} = storeToRefs(controlStore);
watch(trajectoriesRecording, () => {

    sendToNode(id, "run", {
        createTrajectories: controlStore.trajectoriesRecording
    });
});

/** Capture selection of atoms to trace */
watch([labelKind, atomsSelector], () => {

    sendToNode(id, "select", {
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
    });
});

/** Max displacement to take part of a single trace */
watch([maxDisplacement], () => {

    sendToNode(id, "gap", {
        maxDisplacement: maxDisplacement.value,
    });
});

/** Capture position clouds related variables */
watch([showPositionClouds, positionCloudsSize, positionCloudsColor],
      (after:  [boolean, number, string],
       before: [boolean, number, string]) => {

    if(after[2] !== before[2]) renderer.changeColor(after[2]);
    if(after[1] !== before[1]) renderer.changeSize(after[1]);
    renderer.changeCloudsVisibility(after[0]);

    sendToNode(id, "cloud", {
        showPositionClouds: showPositionClouds.value,
        positionCloudsSize: positionCloudsSize.value,
        positionCloudsColor: positionCloudsColor.value
    });
});

/** Receive a set of traces */
receiveTracesFromNode(id, "traces", (segments: number[][], colors: string[]): void => {
    renderer.receiveTraces(segments, colors, showPositionClouds.value);
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showTrajectories" color="primary" label="Show trajectories"
            density="compact" class="mt-2 ml-2"
            @update:modelValue="renderer.setVisibility(showTrajectories)" />
  <v-btn block class="mb-6" @click="resetTraces">Clear trajectories</v-btn>
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    :disabled="trajectoriesRecording"
                    title="Select traced atoms by" placeholder="Traced atoms selector" />
  <g-debounced-slider v-slot="{value}" v-model="maxDisplacement"
                      :disabled="trajectoriesRecording"
                      :step="0.01" :min="0.01" :max="3" class="ml-1 my-4">
    <v-label :text="`Max displacement (${value.toFixed(2)})`" class="no-select" />
  </g-debounced-slider>
  <v-switch v-model="showPositionClouds" color="primary" label="Show position clouds"
            density="compact" class="ml-2" />
  <v-container v-if="showPositionClouds" class="pa-0 mb-2">
    <g-debounced-slider v-slot="{value}" v-model="positionCloudsSize"
                        :step="1" :min="10" :max="200" class="ml-1 mb-4">
      <v-label :text="`Point sprite size (${value})`" class="no-select" />
    </g-debounced-slider>
    <g-color-selector v-model="positionCloudsColor" label="Cloud color" />
  </v-container>
  <v-btn block :disabled="atomsSelector.trim() === '' && labelKind !== 'all'" @click="toggleRecording">
    {{ controlStore.trajectoriesRecording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
