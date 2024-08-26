<script setup lang="ts">
/**
 * @component
 * Enable capture switches for the Structure reader module.
 * Each switch is enabled if the corresponding has* variable is set in the controlStore.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-26
 */
import {useControlStore} from "../stores/controlStore";

// Access the global control area
const controlStore = useControlStore();

</script>


<template>
<v-container class="pa-0">
  <v-switch v-if="controlStore.hasCapture" v-model="controlStore.movie"
            color="primary" label="Movie from steps" density="compact" class="mt-n5" />
  <v-switch v-if="controlStore.hasTrajectory" v-model="controlStore.trajectoriesRecording"
            color="primary" label="Record trajectories" density="compact" class="mt-n5" />
  <v-switch v-if="controlStore.hasFingerprints" v-model="controlStore.fingerprintsAccumulate"
            color="primary" label="Accumulate for fingerprinting" density="compact" class="mt-n5" />
</v-container>
</template>
