<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
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

sb.getUiParams(props.id, (params: UiParams) => {
    showTrajectories.value = params.showTrajectories as boolean ?? false;
    labelKind.value = params.labelKind as string ?? "symbol";
    atomsSelector.value = params.atomsSelector as string ?? "";
    recording.value = params.recording as boolean ?? false;
    reset.value = params.reset as boolean ?? false;
});
watchEffect(() => {
    sb.setUiParams(props.id, {
        showTrajectories: showTrajectories.value,
        labelKind: labelKind.value,
        atomsSelector: atomsSelector.value,
        recording: recording.value,
        reset: reset.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showTrajectories" color="primary" label="Show trajectories"
            density="compact" class="mt-2 ml-2" />
  <v-btn block @click="reset = true">Clear trajectories</v-btn>
  <v-label text="Select traced atoms by" class="mb-3 mt-6" /><br>
  <v-btn-toggle v-model="labelKind" color="primary" class="mb-6">
    <v-btn value="symbol">Symbol</v-btn>
    <v-btn value="label">Label</v-btn>
    <v-btn value="index">Index</v-btn>
  </v-btn-toggle>
  <v-text-field v-model="atomsSelector" label="Traced atoms selector" class="mb-8"
                placeholder="Space separated list"
                variant="solo-filled" hide-details="auto" clearable />
  <v-btn block @click="recording = !recording">
    {{ recording ? "Stop trajectories" : "Start trajectories" }}
  </v-btn>
</v-container>
</template>
