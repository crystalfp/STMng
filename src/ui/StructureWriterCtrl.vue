<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed, watch} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "@/stores/controlStore";
import {askNode} from "@/services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import type {FileFilter} from "@/types";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Show this module has been loaded and access the control store value set in the reader
const controlStore = useControlStore();
controlStore.hasWriter = true;
const {writerAccumulate} = storeToRefs(controlStore);

/** Formats that could be saved */
const fileFormats = ["CHGCAR", "CIF", "POSCAR", "Shel-X", "XYZ"];

const format         = ref("");
const outputFile     = ref("");
const outputFileFull = ref("");
const continuous     = ref(false);
const finish         = ref(false);
const writerLabel    = ref("");

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
.catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`,
                                          "structureWriter"));

/** Define the label for the capture button */
const captureButtonLabel = computed(() => {

    if(continuous.value) return writerAccumulate.value ? "Stop" : "Start";
    return "Capture";
});

watch([writerAccumulate], () => {

    continuous.value = writerAccumulate.value;
});

/**
 * Start and stop the capture
 */
const startStopCapture = (): void => {

    if(continuous.value) {

        controlStore.writerAccumulate = !controlStore.writerAccumulate;
        askNode(id, "write", {
                        continuous: true,
                        inProgress: controlStore.writerAccumulate,
                        format: format.value,
                        filename: outputFileFull.value
            })
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = !controlStore.writerAccumulate;
            })
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"));
    }
    else {
        controlStore.writerAccumulate = true;
        askNode(id, "write", {
                        continuous: false,
                        format: format.value,
                        filename: outputFileFull.value
            })
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = true;
            })
            .finally(() => {controlStore.writerAccumulate = false;})
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"));
    }
};

// > Set filters
/**
 * Create the file selector filter for the given format
 *
 * @param fileFormat - Format for which a file selector filter should be retrieved
 * @returns JSON encoded filter
 */
const filterFromFormat = (fileFormat: string): string => {

    let filter: FileFilter[];
	switch(fileFormat) {
        case "CHGCAR":
            filter = [{name: "CHGCAR",	extensions: ["chgcar"]},
                      {name: "All",	extensions: ["*"]}];
            break;
        case "CIF":
            filter = [{name: "CIF",	extensions: ["cif"]},
                      {name: "All",	extensions: ["*"]}];
            break;
        case "POSCAR":
            filter = [{name: "POSCAR",	extensions: ["poscar"]},
                      {name: "All",	extensions: ["*"]}];
            break;
        case "Shel-X":
            filter = [{name: "Shel-X",	extensions: ["res"]},
                      {name: "All",	extensions: ["*"]}];
            break;
        case "XYZ":
            filter = [{name: "XYZ",	extensions: ["xyz"]},
                      {name: "All",	extensions: ["*"]}];
            break;
        default:
            filter = [{name: "All",	extensions: ["*"]}];
            break;
	}

    return JSON.stringify(filter);
};

// > Save the selected file
/**
 * Save the selected file
 *
 * @param filename - Selected filename
 */
const selectedSaveFile = (filename: string): void => {

    if(filename) {
        outputFileFull.value = filename;
        const pos = filename.lastIndexOf("/");
        outputFile.value = filename.slice(pos+1);
    }
    else {
        outputFile.value = "";
        outputFileFull.value = "";
    }
};

</script>


<template>
<v-container class="container">
  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4 mb-4" @update:model-value="writerLabel=''"/>

  <g-select-file v-model="writerLabel" class="mt-2" :disabled="format === ''" title="Select output file"
                 :filter="filterFromFormat(format)"
                 kind="save" @selected="selectedSaveFile" />

  <v-row class="mt-10" >
    <v-switch v-model="continuous" label="Continuous write" density="compact"
              class="ml-6 mr-8 mt-n1" :disabled="controlStore.writerAccumulate" />
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
