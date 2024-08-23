<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, computed} from "vue";
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
        askNode(id, "write", {
                        continuous: true,
                        inProgress: inProgress.value,
                        format: format.value,
                        filename: outputFileFull.value
            })
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = !inProgress.value;
            })
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"));
    }
    else {
        inProgress.value = true;
        askNode(id, "write", {
                        continuous: false,
                        format: format.value,
                        filename: outputFileFull.value
            })
            .then((params) => {
                if("error" in params) throw Error(params.error as string);
                finish.value = true;
            })
            .catch((error: Error) => showAlertMessage(`Error writing: ${error.message}`,
                                                      "structureWriter"))
            .finally(() => inProgress.value = false);
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

    let filters = [{name: "All",	extensions: ["*"]}];
	switch(fileFormat) {
        case "CHGCAR":
            filters = [{name: "CHGCAR",	extensions: ["chgcar"]},
                       {name: "All",	extensions: ["*"]}];
            break;
        case "CIF":
            filters = [{name: "CIF",	extensions: ["cif"]},
                       {name: "All",	extensions: ["*"]}];
            break;
        case "POSCAR":
            filters = [{name: "POSCAR",	extensions: ["poscar"]},
                       {name: "All",	extensions: ["*"]}];
            break;
        case "Shel-X":
            filters = [{name: "Shel-X",	extensions: ["res"]},
                       {name: "All",	extensions: ["*"]}];
            break;
        case "XYZ":
            filters = [{name: "XYZ",	extensions: ["xyz"]},
                       {name: "All",	extensions: ["*"]}];
            break;
	}

    return JSON.stringify(filters);
};

// > Save the selected file name
/**
 * Save the selected file name
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
            :items="fileFormats" class="mt-4" density="compact" />

  <g-select-file class="mt-2" :disabled="format === ''" title="Select save file" :filter="filterFromFormat(format)"
                 kind="save" :format="format" @selected="selectedSaveFile" />

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
