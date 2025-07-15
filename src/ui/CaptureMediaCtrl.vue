<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {computed} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import NodeAlert from "@/widgets/NodeAlert.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";

// > Access the stores
const configStore = useConfigStore();
const controlStore = useControlStore();

// Show this module has been loaded
controlStore.hasCapture = true;

/** Simplify label */
const startStop = computed(() => (controlStore.movie ? "Stop recording" : "Start recording"));

</script>


<template>
<v-container class="container">
  <v-label class="mt-n1 separator-title first-title">Snapshot</v-label>

  <titled-slot title="Format:" inline class="mt-4 ml-0 mb-3">
    <v-btn-toggle v-model="configStore.camera.snapshotFormat" mandatory>
      <v-btn value="png">PNG</v-btn>
      <v-btn value="jpeg">JPEG</v-btn>
      <v-btn value="pdf">PDF</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <v-switch v-model="configStore.camera.snapshotTransparent"
            :disabled="configStore.camera.snapshotFormat!=='png'"
            label="Transparent background" class="mt-4 ml-2" />
  <v-btn block class="mt-4" @click="controlStore.snapshot = true">Capture snapshot</v-btn>
  <node-alert node="captureSnapshot" class="mt-4" />

  <v-label class="mt-10 separator-title">Movie</v-label>
  <v-btn block class="mt-3" :color="controlStore.movie ? 'red' : 'primary'"
        @click="controlStore.movie = !controlStore.movie">{{ startStop }}</v-btn>
  <node-alert node="captureMovie" class="mt-4" />

  <v-label class="mt-10 separator-title">STL</v-label>

  <titled-slot title="Format:" inline class="mt-4 ml-0 mb-6">
    <v-btn-toggle v-model="configStore.camera.stlFormat" mandatory>
      <v-btn value="ascii">ASCII</v-btn>
      <v-btn value="binary">Binary</v-btn>
    </v-btn-toggle>
  </titled-slot>

  <v-btn block class="mt-3" @click="controlStore.stl = true">Capture geometry</v-btn>
  <node-alert node="captureSTL" class="mt-4" />
</v-container>
</template>
