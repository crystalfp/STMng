<script setup lang="ts">

import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

</script>


<template>
<v-container class="container">
  <v-label class="text-h5 w-100 justify-center mt-4">Snapshot</v-label>
  <v-row class="mt-4">
  <v-label class="pb-5 ml-3">Format:</v-label>
  <v-radio-group v-model="configStore.camera.snapshotFormat" inline class="ml-3">
    <v-radio label="JPEG" value="jpeg" />
    <v-radio label="PNG" value="png" />
  </v-radio-group>
  </v-row>
  <v-btn block class="mt-3" @click="configStore.control.snapshot = true">Capture snapshot</v-btn>
  <v-divider :thickness="8" class="mt-4" />
  <v-label class="mt-4 text-h5 w-100 justify-center">Movie</v-label>
  <v-btn block class="mt-3"
        @click="configStore.control.movie = !configStore.control.movie">
      {{ configStore.control.movie ? "Stop recording" : "Start recording" }}
  </v-btn>
</v-container>
</template>
