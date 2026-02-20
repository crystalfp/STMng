<script setup lang="ts">
/**
 * @component
 * Controls for the atoms' trajectories visualization.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-12
 */

import {computed, ref, watch} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "@/stores/controlStore";
import {askNode, receiveSegmentsFromNode, sendToNode} from "@/services/RoutesClient";
import {showSystemAlert} from "@/services/AlertMessage";
import {TrajectoriesRenderer} from "@/renderers/TrajectoriesRenderer";
import type {AtomSelectorModes, PositionType} from "@/types";

import AtomsChooser from "@/widgets/AtomsChooser.vue";
import DebouncedSlider from "@/widgets/DebouncedSlider.vue";
import ThrottledButton from "@/widgets/ThrottledButton.vue";
import BlockButton from "@/widgets/BlockButton.vue";

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
controlStore.trajectoriesHasSelector = false;

const showTrajectories = ref(false);
const labelKind = ref<AtomSelectorModes>("symbol");
const atomsSelector = ref("");
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);
const positionCloudsSize = ref(100);

// > Initialize the ui
askNode(id, "init")
    .then((params) => {
        showTrajectories.value    = params.showTrajectories as boolean ?? false;
        labelKind.value           = params.labelKind as AtomSelectorModes ?? "symbol";
        atomsSelector.value       = params.atomsSelector as string ?? "";
        maxDisplacement.value     = params.maxDisplacement as number ?? 1;
        showPositionClouds.value  = params.showPositionClouds as boolean ?? false;
		positionCloudsSize.value  = params.positionCloudsSize as number ?? 100;
    })
    .catch((error: Error) => {
        showSystemAlert(`Error from UI init for ${label}: ${error.message}`);
    });

// > Initialize graphical rendering
const renderer = new TrajectoriesRenderer(id,
                                          showTrajectories.value,
                                          showPositionClouds.value,
                                          positionCloudsSize.value);

/**
 * Toggle capturing trajectories
 */
const toggleRecording = (): void => {

    controlStore.trajectoriesRecording = !controlStore.trajectoriesRecording;
};

/**
 * Clear the accumulated structures
 */
const resetTraces = (): void => {

    renderer.resetTraces();
    toggleRecording();

    sendToNode(id, "reset");
};

const {trajectoriesRecording} = storeToRefs(controlStore);
watch(trajectoriesRecording, () => {

    sendToNode(id, "run", {
        createTrajectories: controlStore.trajectoriesRecording
    });
});

/** Capture selection of atoms to trace */
watch([labelKind, atomsSelector], () => {

    controlStore.trajectoriesHasSelector = atomsSelector.value.trim() !== "" ||
                                           labelKind.value === "all";

});

/** Max displacement to take part of a single trace */
watch([maxDisplacement], () => {

    sendToNode(id, "gap", {
        maxDisplacement: maxDisplacement.value,
    });
});

/** Capture position clouds related variables */
watch([showPositionClouds, positionCloudsSize],
      (after:  [boolean, number], before: [boolean, number]) => {

    if(after[1] !== before[1]) renderer.changeSize(after[1]);
    renderer.changeCloudsVisibility(after[0]);

    sendToNode(id, "cloud", {
        showPositionClouds: after[0],
        positionCloudsSize: after[1]
    });
});

/** Receive last segment of a trace */
receiveSegmentsFromNode(id, (segments: PositionType[][], colors: string[], skip: boolean[]): void => {

    renderer.receiveSegments(segments, colors, skip, showPositionClouds.value);
});

/** Simplify label */
const startStop = computed(() => (controlStore.trajectoriesRecording ?
                                            "Stop trajectories" :
                                            "Start trajectories"));
const startStopColor = computed(() => (controlStore.trajectoriesRecording ? "red" : "primary"));

</script>


<template>
<v-container class="container">
  <atoms-chooser :id v-model:kind="labelKind" v-model:selector="atomsSelector"
                 channel="select"
                 :disabled="trajectoriesRecording" class="ml-0 mt-6 mb-n6"
                 title="Select traced atoms by" placeholder="Traced atoms selector" />
  <v-switch v-model="showTrajectories" label="Show trajectories" class="mt-4 ml-2"
            @update:modelValue="renderer.changeTracesVisibility(showTrajectories!)" />
  <debounced-slider v-if="showTrajectories" v-slot="{value}" v-model="maxDisplacement"
                      :disabled="trajectoriesRecording"
                      :step="0.01" :min="0.01" :max="3" class="ml-1 mb-4 mt-4">
    <v-label :text="`Max displacement (${value.toFixed(2)})`" class="no-select" />
  </debounced-slider>
  <v-switch v-model="showPositionClouds" label="Show position clouds" class="ml-2 mb-6" />
  <v-container v-if="showPositionClouds" class="pa-0 mb-2">
    <debounced-slider v-slot="{value}" v-model="positionCloudsSize"
                      :step="1" :min="30" :max="300" class="ml-1 mb-4">
      <v-label :text="`Point cloud size (${value}%)`" class="no-select" />
    </debounced-slider>
  </v-container>
  <throttled-button class="mb-2"
                    label="Show averages" @click="sendToNode(id, 'means')" />
  <block-button class="mb-2"
         :disabled="atomsSelector.trim() === '' && labelKind !== 'all'"
         :color="startStopColor" :label="startStop" @click="toggleRecording"/>
  <block-button label="Clear trajectories" @click="resetTraces"/>
</v-container>
</template>
