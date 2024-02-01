<script setup lang="ts">
/**
 * @component
 * Controls for the capture media node.
 */
import {ref, watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";

// > Access the store
const configStore = useConfigStore();

// > Prepare the alerts
const typeM = ref<"error" | "success" | "warning" | "info" | undefined>();
const textM = ref("");
watchEffect(() => {
    const status = configStore.control.movieMessage;
    typeM.value = undefined;
    if(!status) return;
    const parts = status.split("|");

    typeM.value = parts[0] === "E" ? "error" : "success";
    textM.value = parts[1];
});
const typeS = ref<"error" | "success" | "warning" | "info" | undefined>();
const textS = ref("");
watchEffect(() => {
    const status = configStore.control.snapshotMessage;
    typeS.value = undefined;
    if(!status) return;
    const parts = status.split("|");

    typeS.value = parts[0] === "E" ? "error" : "success";
    textS.value = parts[1];
});

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
  <v-alert v-if="typeS !== undefined" :title="typeS === 'error' ? 'Error' : 'Success!'"
          :text="textS" :type="typeS" density="compact" class="mt-4"
          style="cursor: pointer;" @click="typeS=undefined" />
  <v-divider :thickness="8" class="mt-4" />
  <v-label class="mt-4 text-h5 w-100 justify-center">Movie</v-label>
  <v-btn block class="mt-3" :color="configStore.control.movie ? 'error' : 'primary'"
        @click="configStore.control.movie = !configStore.control.movie">
      {{ configStore.control.movie ? "Stop recording" : "Start recording" }}
  </v-btn>
  <v-alert v-if="typeM !== undefined" :title="typeM === 'error' ? 'Error' : 'Success!'"
           :text="textM" :type="typeM" density="compact" class="mt-4"
           style="cursor: pointer;" @click="typeM=undefined" />
</v-container>
</template>
