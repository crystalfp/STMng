<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
 */
import {useConfigStore} from "@/stores/configStore";
import {useMessageStore} from "@/stores/messageStore";

// > Access the stores
const configStore = useConfigStore();
const messageStore = useMessageStore();

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
  <v-alert v-if="messageStore.captureMedia.typeS !== undefined"
           :title="messageStore.captureMedia.typeS === 'error' ? 'Error' : 'Success!'"
           :text="messageStore.captureMedia.textS" :type="messageStore.captureMedia.typeS"
           density="compact" class="mt-4 cursor-pointer" color="red"
           @click="messageStore.captureMedia.typeS=undefined" />
  <v-divider thickness="8" class="mt-6" />
  <v-label class="mt-4 text-h5 w-100 justify-center">Movie</v-label>
  <v-btn block class="mt-3" :color="configStore.control.movie ? 'red' : 'primary'"
        @click="configStore.control.movie = !configStore.control.movie">
      {{ configStore.control.movie ? "Stop recording" : "Start recording" }}
  </v-btn>
  <v-alert v-if="messageStore.captureMedia.typeM !== undefined"
           :title="messageStore.captureMedia.typeM === 'error' ? 'Error' : 'Success!'"
           :text="messageStore.captureMedia.textM" :type="messageStore.captureMedia.typeM"
           density="compact" class="mt-4 cursor-pointer" color="red"
           @click="messageStore.captureMedia.typeM=undefined" />
</v-container>
</template>
