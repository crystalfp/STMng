<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {useMessageStore} from "@/stores/messageStore";

// > Access the stores
const configStore = useConfigStore();
const controlStore = useControlStore();
const messageStore = useMessageStore();

// Show this module has been loaded
controlStore.hasCapture = true;

</script>


<template>
<v-container class="container">
  <v-label class="mt-4 separator-title">Snapshot</v-label>
  <v-row class="mt-4">
  <v-label class="pb-3 ml-3 mr-4 no-select">Format:</v-label>
  <v-btn-toggle v-model="configStore.camera.snapshotFormat" mandatory class="mb-3">
    <v-btn value="jpeg">JPEG</v-btn>
    <v-btn value="png">PNG</v-btn>
  </v-btn-toggle>
  </v-row>
  <v-btn block class="mt-6" @click="controlStore.snapshot = true">Capture snapshot</v-btn>
  <v-alert v-if="messageStore.captureMedia.typeS !== undefined"
           :title="messageStore.captureMedia.typeS === 'error' ? 'Error' : 'Success!'"
           :text="messageStore.captureMedia.textS" :type="messageStore.captureMedia.typeS"
           density="compact" class="mt-4 cursor-pointer"
           @click="messageStore.captureMedia.typeS=undefined" />

  <v-label class="mt-10 separator-title">Movie</v-label>
  <v-btn block class="mt-3" :color="controlStore.movie ? 'red' : 'primary'"
        @click="controlStore.movie = !controlStore.movie">
      {{ controlStore.movie ? "Stop recording" : "Start recording" }}
  </v-btn>
  <v-alert v-if="messageStore.captureMedia.typeM !== undefined"
           :title="messageStore.captureMedia.typeM === 'error' ? 'Error' : 'Success!'"
           :text="messageStore.captureMedia.textM" :type="messageStore.captureMedia.typeM"
           density="compact" class="mt-4 cursor-pointer"
           @click="messageStore.captureMedia.typeM=undefined" />

  <v-label class="mt-10 separator-title">STL</v-label>
  <v-row class="mt-4">
  <v-label class="pb-6 ml-3 mr-4 no-select">Format:</v-label>
  <v-btn-toggle v-model="configStore.camera.stlFormat" mandatory class="mb-6">
    <v-btn value="ascii">ASCII</v-btn>
    <v-btn value="binary">Binary</v-btn>
  </v-btn-toggle>
  </v-row>
  <v-btn block class="mt-3" @click="controlStore.stl = true">Capture geometry</v-btn>
  <v-alert v-if="messageStore.captureMedia.typeT !== undefined"
           :title="messageStore.captureMedia.typeT === 'error' ? 'Error' : 'Success!'"
           :text="messageStore.captureMedia.textT" :type="messageStore.captureMedia.typeT"
           density="compact" class="mt-4 cursor-pointer"
           @click="messageStore.captureMedia.typeT=undefined" />
</v-container>
</template>
