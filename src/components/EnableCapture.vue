<script setup lang="ts">
/**
 * @component
 * Enable capture switches for the Structure reader module.
 * Each switch is enabled if the corresponding `has*` variable is set in the controlStore.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-26
 */
import {useControlStore} from "@/stores/controlStore";

// Access the global control area
const controlStore = useControlStore();

</script>


<template>
<v-container class="pa-0">
  <v-switch v-if="controlStore.hasCapture" v-model="controlStore.movie"
            label="Movie from steps" class="mt-n5" />
  <v-switch v-if="controlStore.hasTrajectory" v-model="controlStore.trajectoriesRecording"
            label="Record trajectories" class="mt-n5" />
  <v-switch v-if="controlStore.hasFingerprints" v-model="controlStore.fingerprintsAccumulate"
            label="Accumulate for fingerprinting" class="mt-n5" />
  <v-switch v-if="controlStore.hasWriter" v-model="controlStore.writerAccumulate"
            label="Collect for structure writer" class="mt-n5" />
</v-container>
</template>
