<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 */

import {ref, watchEffect, computed} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";
import {mdiFileOutline} from "@mdi/js";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.structureWriter.message = "";

/** Formats that could be loaded */
const fileFormats = ["CHGCAR", "CIF", "POSCAR", "XYZ"];

const format         = ref("");
const outputFile     = ref("");
const outputFileFull = ref("");
const inProgress     = ref(false);
const continuous     = ref(false);
const doSelectFile   = ref(false);
const finish         = ref(false);

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
    outputFileFull.value = params.outputFile as string ?? "";
    continuous.value = params.continuous as boolean ?? false;
    inProgress.value = params.inProgress as boolean ?? false;
    finish.value = params.finish as boolean ?? false;

    if(outputFileFull.value === "") outputFile.value = "";
    else {
        const pos = outputFileFull.value.lastIndexOf("/");
        outputFile.value = outputFileFull.value.slice(pos+1);
    }
});
watchEffect(() => {
    sb.setUiParams(pr.id, {
        format: format.value,
        selectFile: doSelectFile.value,
        continuous: continuous.value,
        inProgress: inProgress.value,
        finish: finish.value
    });
});

</script>


<template>
<v-container class="container">
  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4" density="compact" />

  <v-row :disabled="format === ''" class="mt-2" @click="doSelectFile = true">
    <v-icon :icon="mdiFileOutline" size="x-large" class="ml-4 mr-2 mt-1" style="opacity: 0.4" />
    <v-text-field :disabled="format === ''" v-model="outputFile" label="Select save file"
                  class="mb-2 mr-2" hide-details="auto" />
  </v-row>

  <v-row class="mt-10">
    <v-switch v-model="continuous" color="primary" label="Continuous write"
              density="compact" class="ml-4 mr-5" />
    <v-btn :disabled="format === '' || outputFile === ''" @click="startStopCapture">
      {{ captureButtonLabel }}
    </v-btn>
  </v-row>
  <v-alert v-if="finish" title="Done" class="mt-7 cursor-pointer"
           :text="`File written to: ${outputFileFull}`" type="success" density="compact"
           @click="finish=false" />
  <v-alert v-if="messageStore.structureWriter.message !== ''" title="Error" class="mt-7 cursor-pointer"
           :text="messageStore.structureWriter.message" type="error" density="compact"
           color="red" @click="messageStore.structureWriter.message=''" />
  </v-container>
</template>
