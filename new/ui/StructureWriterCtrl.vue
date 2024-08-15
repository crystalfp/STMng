<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 */

import {ref, computed} from "vue";
import {mdiFileOutline} from "@mdi/js";
import {useMessageStore} from "../stores/messageStore";
import {askNode} from "../services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "../services/AlertMessage";

// > Properties
const {id} = defineProps<{

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
const finish         = ref(false);

// Initialize the control
resetAlertMessage("structureWriter");
askNode(id, "init").then((params) => {

    format.value = params.format as string ?? "";
    continuous.value = params.continuous as boolean ?? false;
    outputFileFull.value = params.outputFilename as string ?? "";
    if(outputFileFull.value === "") outputFile.value = "";
    else {
        const pos = outputFileFull.value.lastIndexOf("/");
        outputFile.value = outputFileFull.value.slice(pos+1);
    }
})
.catch((error: Error) => showAlertMessage(`Error from UI init for StructureWriter: ${error.message}`,
                                          "structureWriter"));

/** Define the label for the capture button */
const captureButtonLabel = computed(() => {

    if(continuous.value) return inProgress.value ? "Stop" : "Start";
    return "Capture";
});

/**
 * Start and stop the capture
 */
const startStopCapture = (): void => {

    if(continuous.value) {

        inProgress.value = !inProgress.value;
        askNode(id, "write", {continuous: true, inProgress: inProgress.value})
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = !inProgress.value;
            })
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"));
    }
    else {
        inProgress.value = true;
        askNode(id, "write", {continuous: false})
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = true;
            })
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"))
            .finally(() => inProgress.value = false);
    }
};

/**
 * Send selection request to main process and receive the selected file full path
 */
const selectSaveFile = (): void => {

    inProgress.value = true;
    askNode(id, "select", {format: format.value})
        .then((params) => {

            const filename = params.filename as string;

            if(filename) {
                outputFileFull.value = filename;
                const pos = filename.lastIndexOf("/");
                outputFile.value = filename.slice(pos+1);
            }
            else {
                outputFile.value = "";
                outputFileFull.value = "";
            }
        })
        .catch((error: Error) => showAlertMessage(`Error from save file select: ${error.message}`,
                                          "structureWriter"))
        .finally(() => inProgress.value = false);
};

</script>


<template>
<v-container class="container">
  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4" density="compact" />

  <v-row :disabled="format === ''" class="mt-2" @click="selectSaveFile">
    <v-icon :icon="mdiFileOutline" size="x-large" class="ml-4 mr-2 mt-1" style="opacity: 0.4" />
    <v-text-field v-model="outputFile" :disabled="format === ''" label="Select save file" readonly
                  class="mb-2 mr-2" hide-details="auto" :loading="inProgress" spellcheck="false" />
  </v-row>

  <v-row class="mt-10">
    <v-switch v-model="continuous" color="primary" label="Continuous write"
              density="compact" class="ml-6 mr-5" :disabled="inProgress" />
    <v-btn :disabled="format === '' || outputFile === ''" @click="startStopCapture">
      {{ captureButtonLabel }}
    </v-btn>
  </v-row>
  <v-alert v-if="finish" title="Done" class="mt-7 cursor-pointer"
           :text="`File written to: ${outputFileFull}`" type="success" density="compact"
           @click="finish=false" />
  <g-error-alert kind="structureWriter"/>
  </v-container>
</template>
