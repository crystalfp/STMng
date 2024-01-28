<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
 * Movie capture not yet implemented.
 */

import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

</script>


<template>
<v-container class="container">
  <v-label class="text-h5 w-100 justify-center mt-4">Snapshot</v-label>
  <v-row class="mt-4">
  <v-label class="pb-3 ml-3 mr-4">Format:</v-label>
  <v-btn-toggle v-model="configStore.camera.snapshotFormat" color="primary" class="mb-3">
    <v-btn value="jpeg">JPEG</v-btn>
    <v-btn value="png">PNG</v-btn>
  </v-btn-toggle>
  </v-row>
  <v-btn block class="mt-3" @click="configStore.control.snapshot = true">Capture snapshot</v-btn>
  <v-divider :thickness="8" class="mt-4" />
  <v-label class="mt-4 text-h5 w-100 justify-center">Movie</v-label>
  <v-btn block class="mt-3"
        @click="configStore.control.movie = !configStore.control.movie">
      {{ configStore.control.movie ? "Stop recording" : "Start recording" }}
  </v-btn>
  <v-alert title="Not yet implemented" text="Movie capture not yet implemented"
           type="error" density="compact" color="red" class="mt-4" />
</v-container>
</template>
