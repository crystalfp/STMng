<script setup lang="ts">
/**
 * @component
 * Controls for the atoms' trajectories visualization.
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

const showTrajectories = ref(false);
const labelKind = ref("symbol");
const atomsSelector = ref("");
const recording = ref(false);
const reset = ref(false);
const maxDisplacement = ref(1);
const showPositionClouds = ref(false);
const positionCloudsSide = ref(10);

sb.getUiParams(props.id, (params: UiParams) => {
    showTrajectories.value    = params.showTrajectories as boolean ?? false;
    labelKind.value           = params.labelKind as string ?? "symbol";
    atomsSelector.value       = params.atomsSelector as string ?? "";
    recording.value           = params.recording as boolean ?? false;
    reset.value               = params.reset as boolean ?? false;
    maxDisplacement.value     = params.maxDisplacement as number ?? 1;
    showPositionClouds.value  = params.showPositionClouds as boolean ?? false;
    positionCloudsSide.value  = params.positionCloudsSide as number ?? 10;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showTrajectories: showTrajectories.value,
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
        recording: recording.value,
        reset: reset.value,
        maxDisplacement: maxDisplacement.value,
        showPositionClouds: showPositionClouds.value,
        positionCloudsSide: positionCloudsSide.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showTrajectories" color="primary" label="Show trajectories"
            density="compact" class="mt-2 ml-2" />
  <v-btn block class="mb-6" @click="reset = true">Clear trajectories</v-btn>
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    title="Select traced atoms by" placeholder="Traced atoms selector" />
  <g-debounced-slider v-slot="{value}" v-model="maxDisplacement"
                      :step="0.01" :min="0.01" :max="3" class="ml-1 my-4">
    <v-label :text="`Max displacement (${value})`" />
  </g-debounced-slider>
  <!-- <v-switch v-model="showPositionClouds" color="primary" label="Show position clouds"
            density="compact" class="ml-2" />
  <v-container v-if="showPositionClouds" class="pa-0">
    <v-number-input v-model="positionCloudsSide" :min="2" :step="1" label="Cloud volume subdivisions" />
  </v-container> -->
  <v-btn block :disabled="atomsSelector.trim() === '' && labelKind !== 'all'" @click="recording = !recording">
    {{ recording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
