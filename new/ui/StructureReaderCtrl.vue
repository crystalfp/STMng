<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-16
 */

import {ref, watch} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight,
        mdiChevronLeft, mdiChevronRight} from "@mdi/js";
import {askNode, sendToNode, receiveFromNode} from "../services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "../services/AlertMessage";
import type {CtrlParams} from "../types";

import EnableCapture from "../components/EnableCapture.vue";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

/** Formats that could be loaded */
const fileFormats = [
    "CHGCAR",
    "CIF",
    "Gaussian Cube",
    "LAMMPS",
    "LAMMPStrj",
    "POSCAR",
    "POSCAR + XDATCAR",
    "Shel-X",
    "XYZ"
];

// > UI parameters
const fileToRead       = ref("");           // Path of the file to be read
const countSteps       = ref(1);            // Total steps read
const step             = ref(1);            // Current step
const running          = ref(false);        // The steps are playing
const atomsTypes       = ref("");           // Atom types in the structure read
const loopSteps        = ref(false);        // If the sequence should loop
const format           = ref("");           // File format to be read
const inProgress       = ref(false);        // True during file load
const auxFileToRead    = ref("");           // Path to the auxiliary file to read
const useBohr          = ref(true);         // Use Bohr units

// Initialize the control
resetAlertMessage("structureReader");
askNode(id, "init")
    .then((params) => {

        loopSteps.value     = params.loopSteps as boolean ?? false;
        format.value        = params.format as string ?? "";
        atomsTypes.value    = params.atomsTypes as string ?? "";
        useBohr.value       = params.useBohr as boolean ?? true;
        fileToRead.value    = params.fileToRead as string ?? "";
        auxFileToRead.value = params.auxFileToRead as string ?? "";
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for StructureReader: ${error.message}`, "structureReader"));

// Manage the step selection
watch([step, running, loopSteps], () => {

    askNode(id, "step", {
        step: step.value,
        running: running.value,
        loopSteps: loopSteps.value,
    })
    .then((params) => {
        if(running.value && params.running === false) running.value = false;
    })
    .catch((error: Error) => {
        showAlertMessage(`Error from stepping: ${error.message}`, "structureReader");
    });
});

receiveFromNode(id, "runningStep", (params: CtrlParams) => {

    step.value = params.step as number ?? 1;

    if(running.value) {
        const updatedRunning = params.running as boolean;
        if(updatedRunning !== undefined && !updatedRunning) {
            running.value = false;
        }
    }
});

/**
 * Change the current step by delta steps
 *
 * @param delta - How many steps the current one should move
 */
const deltaStep = (delta: number): void => {

    const changedStep = step.value + delta;
    if(changedStep < 1 || changedStep > countSteps.value) return;
    step.value = changedStep;
};

/**
 * Start/stop automatic play of steps
 */
const togglePlay = (): void => {

    if(running.value) running.value = false;
    else if(step.value < countSteps.value) running.value = true;
    else if(loopSteps.value) {
        step.value = 1;
        running.value = true;
    }
};

/**
 * Set the file format to load
 */
const setFormat = (): void => {

    sendToNode(id, "formats", {format: format.value});

    fileToRead.value = "";
    countSteps.value = 1;
    step.value = 1;
};

/** Formats that needs atoms types */
const formatsThatNeedsAtomTypes = new Set(["POSCAR", "CHGCAR", "LAMMPS", "LAMMPStrj", "POSCAR + XDATCAR"]);

/**
 * Check if the format needs the atom types
 *
 * @param fileFormat - The format to check
 * @returns The check result
 */
const needsAtomTypes = (fileFormat: string): boolean => formatsThatNeedsAtomTypes.has(fileFormat);

/**
 * Get atoms types field value on blur or ENTER pressed
 */
const getAtomsTypes = (): void => {

    sendToNode(id, "types", {atomsTypes: atomsTypes.value});
};

/**
 * On change of the measurement unit
 */
const setUseBohr = (): void => {

    sendToNode(id, "bohr", {useBohr: useBohr.value});
};

// > Load structure file
/**
 * Start loading a structure file
 *
 * @param filename - Selected filename
 * @param fileFormat - Format of the file to be read
 */
const selectedFile = (filename: string, fileFormat: string): void => {

    step.value = 1;
    fileToRead.value = filename;
    inProgress.value = true;

    askNode(id, "read", {
            format: fileFormat,
            fileToRead: filename,
            atomsTypes: atomsTypes.value,
            useBohr: useBohr.value,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            inProgress.value = false;
        })
        .catch((error: Error) => {
            inProgress.value = false;
            showAlertMessage(`Error from load file: ${error.message}`, "structureReader");
        });
};

// > Load auxiliary file
/**
 * Start loading an auxiliary file
 *
 * @param filename - Selected filename
 * @param fileFormat - Format of the file to be read
 */
const selectedAuxFile = (filename: string, fileFormat: string): void => {

    askNode(id, "aux", {
            format: fileFormat,
            auxFileToRead: filename,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
        })
        .catch((error: Error) => {
            showAlertMessage(`Error from load aux file: ${error.message}`, "structureReader");
        });
};


// > Set filters
/**
 * Create the file selector filter for the given format
 *
 * @param fileFormat - Format for which a file selector filter should be retrieved
 * @returns JSON encoded filter
 */
const filterFromFormat = (fileFormat: string): string => {

    let filter = [{name: "All",	extensions: ["*"]}];
	switch(fileFormat) {
		case "CHGCAR":
			filter = [{name: "CHGCAR",	        extensions: ["chgcar"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "CIF":
			filter = [{name: "CIF",		        extensions: ["cif"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
    	case "Gaussian Cube":
			filter = [{name: "Gaussian Cube",	extensions: ["cube"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
    	case "LAMMPS":
			filter = [{name: "LAMMPS",	        extensions: ["lmp"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
    	case "LAMMPStrj":
			filter = [{name: "LAMMPStrj",	    extensions: ["lammpstrj"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "POSCAR":
		case "POSCAR + XDATCAR":
			filter = [{name: "POSCAR",	        extensions: ["poscar", "poscars"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "Shel-X":
			filter = [{name: "Shel-X",	        extensions: ["res", "ins"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "XYZ":
			filter = [{name: "XYZ",		        extensions: ["xyz"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
	}

    return JSON.stringify(filter);
};

/**
 * Return the JSON encoded filter for XDATCAR auxiliary file
 *
 * @returns JSON encoded filter
 */
const filterForXDATCAR = (): string => JSON.stringify([{name: "XDATCAR", extensions: ["xdatcar"]},
					                                   {name: "All",     extensions: ["*"]}]);

</script>


<template>
<v-container class="container">

  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4"
            density="compact" @update:model-value="setFormat" />

  <v-text-field v-if="needsAtomTypes(format)" v-model="atomsTypes" label="Atoms types"
                placeholder="Space separated list" class="mb-6"
                variant="solo-filled" hide-details="auto" clearable spellcheck="false"
                @blur="getAtomsTypes" @keyup.enter="getAtomsTypes" />

  <g-select-file class="mt-2" :disabled="format === ''" title="Select input file" :filter="filterFromFormat(format)"
                 :format="format" @selected="selectedFile" />

  <g-select-file v-if="format === 'POSCAR + XDATCAR'" class="mt-2" :filter="filterForXDATCAR()"
                 title="Select XDATCAR file" format="XDATCAR" @selected="selectedAuxFile"/>

  <v-switch v-else-if="format === 'Gaussian Cube'" v-model="useBohr" color="primary"
                label="Use Bohr units" density="compact" class="ml-2" @update:model-value="setUseBohr" />
  <v-container v-if="countSteps > 1" class="ml-2 pa-0 mt-4">
    <v-switch v-model="loopSteps" color="primary" label="Loop" density="compact" />
    <enable-capture />
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" class="mr-6" />
    <v-row class="mr-2">
      <v-spacer />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronDoubleLeft" class="mr-1"
              @click="step = 1" />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronLeft" class="mr-1"
              @click="deltaStep(-1)" />
      <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay" class="mr-1"
              @click="togglePlay" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronRight" class="mr-1"
              @click="deltaStep(1)" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronDoubleRight"
              @click="step = countSteps; running = false" />
      <v-spacer />
    </v-row>
  </v-container>
  <g-error-alert kind="structureReader" />
</v-container>
</template>
