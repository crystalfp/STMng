<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 */

import {ref, watchEffect, computed} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

/** Formats that could be loaded */
// const fileFormats = ["CHGCAR", "CIF", "POSCAR", "Shel-X", "XYZ"];
const fileFormats = ["XYZ"];

const format      = ref("");
const outputFile  = ref("");
const inProgress  = ref(false);
const continuous  = ref(false);
const doSelectFile  = ref(false);

/** Define the label for the capture button */
const captureButtonLabel = computed(() => {

     if(continuous.value) {
        return inProgress.value ? "Stop" : "Start";
     }
     return "Capture";
});

/**
 * Start and stop the capture
 */
const startStopCapture = (): void => {

    if(continuous.value) {

        inProgress.value = !inProgress.value;
        sb.setUiParams(pr.id, {
            inProgress: inProgress.value
        });
    }
    else {
        sb.setUiParams(pr.id, {
            inProgress: true
        });
    }
};

sb.getUiParams(pr.id, (params: UiParams) => {
    format.value = params.format as string ?? "";
    doSelectFile.value = params.selectFile as boolean ?? false;
    outputFile.value = params.outputFile as string ?? "";
    continuous.value = params.continuous as boolean ?? false;
    inProgress.value = params.inProgress as boolean ?? false;
});
watchEffect(() => {
    sb.setUiParams(pr.id, {
        format: format.value,
        selectFile: doSelectFile.value,
        continuous: continuous.value,
        inProgress: inProgress.value,
    });
});

</script>


<template>
<v-container class="container">
  <v-row class="mt-4 mb-2">
    <v-menu open-on-hover>
      <template #activator="{ props }">
        <v-btn class="w-25 ml-3" size="small" color="primary" v-bind="props">
          Format
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="fmt in fileFormats" :key="fmt">
          <v-list-item-title style="cursor: pointer" @click="format = fmt">{{ fmt }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-label class="underlined-label">{{ format }}</v-label>
  </v-row>
  <v-row>
    <v-btn :disabled="format === ''" :loading="inProgress" class="w-25 ml-3" size="small"
           @click="doSelectFile = true">
      Select
    </v-btn>
    <v-label class="underlined-label">{{ outputFile }}</v-label>
  </v-row>
  <v-row class="mt-10">
    <v-switch v-model="continuous" color="primary" label="Continuous write"
              density="compact" class="ml-4 mr-5" />
    <v-btn :disabled="format === '' || outputFile === ''" @click="startStopCapture">
      {{ captureButtonLabel }}
    </v-btn>
  </v-row>
  </v-container>
</template>
