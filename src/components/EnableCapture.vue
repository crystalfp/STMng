<script setup lang="ts">
/**
 * @component
 * Enable capture switches for the Structure reader module.
 * Each switch is enabled if the corresponding `has*` variable is set in the controlStore.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-26
 */
import {computed} from "vue";
import {useControlStore} from "@/stores/controlStore";

// Access the global control area
const controlStore = useControlStore();

const showSection = computed<boolean>(() => controlStore.hasCapture ||
                                            controlStore.hasTrajectory ||
                                            controlStore.hasFingerprints ||
                                            controlStore.hasWriter
);

</script>


<template>
<v-container v-if="showSection" class="pa-0 mb-4 mt-n5">
  <v-divider thickness="2" class="mr-n1 ml-n2 mb-2"/>
  <v-switch v-if="controlStore.hasCapture"
            v-model="controlStore.movie"
            label="Movie from steps" />
  <v-switch v-if="controlStore.hasTrajectory"
            v-model="controlStore.trajectoriesRecording"
            label="Record trajectories" />
  <v-switch v-if="controlStore.hasFingerprints"
            v-model="controlStore.fingerprintsAccumulate"
            label="Accumulate for fingerprinting" />
  <v-switch v-if="controlStore.hasWriter"
            v-model="controlStore.writerAccumulate"
            label="Collect for structure writer" />
  <v-divider thickness="2" class="mr-n1 ml-n2 mt-2"/>
</v-container>
</template>
