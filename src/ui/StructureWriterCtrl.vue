<script setup lang="ts">
/**
 * @component
 * Controls for the structure data writer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {ref, computed, watch, onUnmounted} from "vue";
import {storeToRefs} from "pinia";
import {useControlStore} from "@/stores/controlStore";
import {askNode, receiveFromNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import type {CtrlParams, FileFilter} from "@/types";

import SelectFile from "@/widgets/SelectFile.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";

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
const fileFormats = ["CHGCAR", "CIF", "PDB", "POSCAR", "Shel-X", "XYZ"] as const;
const fileFormatsNoUC = ["PDB", "XYZ"];

const format         = ref("");
const outputFile     = ref("");
const outputFileFull = ref("");
const continuous     = ref(false);
const writerLabel    = ref("");
const hasNoUnitCell  = ref(true);

// Initialize the control
resetNodeAlert();
askNode(id, "init").then((params) => {

    format.value = params.format as string ?? "";
    continuous.value = params.continuous as boolean ?? false;
    outputFileFull.value = params.outputFilename as string ?? "";
    if(outputFileFull.value === "") outputFile.value = "";
    else {
        const pos = outputFileFull.value.lastIndexOf("/");
        outputFile.value = outputFileFull.value.slice(pos+1);
    }
    hasNoUnitCell.value = params.hasNoUnitCell as boolean ?? true;
})
.catch((error: Error) => {
    showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                  "structureWriter");
});

/** Define the label for the capture button */
const captureButtonLabel = computed(() => {

    if(continuous.value) return writerAccumulate.value ? "Stop" : "Start";
    return "Capture";
});

const stopWatchers = watch([writerAccumulate], () => {

    continuous.value = writerAccumulate.value;
});

// Cleanup
onUnmounted(() => stopWatchers());

receiveFromNode(id, "has-no-unit-cell", (params: CtrlParams) => {
    hasNoUnitCell.value = params.hasNoUnitCell as boolean ?? false;
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
                if(params.error) throw Error(params.error as string);
                if(!controlStore.writerAccumulate) {
                    showNodeAlert(`File written to: ${outputFileFull.value}`,
                                  "structureWriter", {level: "success"});
                }
            })
            .catch((error: Error) => {
                showNodeAlert(`Error writing structure: ${error.message}`,
                              "structureWriter");
            });
    }
    else {
        controlStore.writerAccumulate = true;
        askNode(id, "write", {
                        continuous: false,
                        format: format.value,
                        filename: outputFileFull.value
            })
            .then((params) => {
                if(params.error) throw Error(params.error as string);
                showNodeAlert(`File written to: ${outputFileFull.value}`,
                              "structureWriter", {level: "success"});
            })
            .finally(() => {controlStore.writerAccumulate = false;})
            .catch((error: Error) => {
                showNodeAlert(`Error writing: ${error.message}`,
                              "structureWriter");
            });
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
            filter = [{name: "CHGCAR", extensions: ["chgcar"]}];
            break;
        case "CIF":
            filter = [{name: "CIF",	extensions: ["cif"]}];
            break;
        case "POSCAR":
            filter = [{name: "POSCAR", extensions: ["poscar"]}];
            break;
        case "PDB":
            filter = [{name: "PDB",	extensions: ["pdb"]}];
            break;
        case "Shel-X":
            filter = [{name: "Shel-X", extensions: ["res"]}];
            break;
        case "XYZ":
            filter = [{name: "XYZ",	extensions: ["xyz"]}];
            break;
        default:
            filter = [];
            break;
	}

    filter.push({name: "All", extensions: ["*"]});

    return JSON.stringify(filter);
};

// > Save the selected file
/**
 * Save the selected file
 *
 * @param filename - Selected filename
 */
const selectedSaveFile = (filename: string): void => {

    resetNodeAlert();

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
            :items="hasNoUnitCell? fileFormatsNoUC : fileFormats"
            class="mt-4 mb-4"
            @update:model-value="writerLabel=''"/>

  <select-file v-model="writerLabel" :disabled="format === ''"
               title="Select output file"
               :filter="filterFromFormat(format)"
               kind="save" @selected="selectedSaveFile" />

  <v-row class="mt-6" >
    <v-switch v-model="continuous" label="Continuous write" density="compact"
              class="ml-3 mr-8 mt-n1" :disabled="controlStore.writerAccumulate" />
    <v-btn :disabled="format === '' || outputFile === ''" @click="startStopCapture">
      {{ captureButtonLabel }}
    </v-btn>
  </v-row>
  <node-alert node="structureWriter" class="mt-7" />
  </v-container>
</template>
