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
import {askNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage, resetAlertMessage} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import type {FileFilter} from "@/types";

import EnableCapture from "@/components/EnableCapture.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

/** Formats that could be loaded */
const fileFormats = [
    "CHGCAR",
    "CEL",
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
const fileToRead    = ref("");      // Path of the file to be read
const countSteps    = ref(1);       // Total steps read
const step          = ref(1);       // Current step
const running       = ref(false);   // The steps are playing
const atomsTypes    = ref("");      // Atom types in the structure read
const loopSteps     = ref(false);   // If the sequence should loop
const stepBackward  = ref(false);   // Run in backward steps
const format        = ref("");      // File format to be read
const inProgress    = ref(false);   // True during file load
const auxFileToRead = ref("");      // Path to the auxiliary file to read
const useBohr       = ref(true);    // Use Bohr units
const stepIncrement = ref(1);       // How many step skip every tick

const controlStore = useControlStore();

// Initialize the control
resetAlertMessage("structureReader");
askNode(id, "init")
    .then((params) => {

        loopSteps.value     = params.loopSteps as boolean ?? false;
        stepBackward.value  = params.stepBackward as boolean ?? false;
        format.value        = params.format as string ?? "";
        atomsTypes.value    = params.atomsTypes as string ?? "";
        useBohr.value       = params.useBohr as boolean ?? true;
        fileToRead.value    = params.fileToRead as string ?? "";
        auxFileToRead.value = params.auxFileToRead as string ?? "";
        stepIncrement.value = params.stepIncrement as number ?? 1;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ${label}: ${error.message}`, "structureReader"));

// Manage the step selection
watch([step, running, loopSteps, stepIncrement, stepBackward], async () => {

    if(!running.value) {

        askNode(id, "step", {
            step: step.value,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
        })
        .catch((error: Error) => {
            showAlertMessage(`Error from stepping: ${error.message}`, "structureReader");
        });
        return;
    }

    while(running.value) {

        let nextStep = step.value;

        if(stepBackward.value) {

            // Steps backward
            nextStep -= stepIncrement.value;

            if(nextStep === 1) {

                if(loopSteps.value) nextStep = countSteps.value;
                else running.value = false;
            }
            else if(nextStep < 1) {
                if(loopSteps.value) nextStep = countSteps.value;
                else {
                    nextStep += stepIncrement.value;
                    running.value = false;
                }
            }
        }
        else {

            // Steps forward
            nextStep += stepIncrement.value;

            if(nextStep === countSteps.value) {

                if(loopSteps.value) nextStep = 1;
                else running.value = false;
            }
            else if(nextStep > countSteps.value) {

                if(loopSteps.value) nextStep = 1;
                else {
                    nextStep -= stepIncrement.value;
                    running.value = false;
                }
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        try {
            const response = await askNode(id, "step", {step: nextStep});
            if("error" in response) throw Error(response.error as string);
            step.value = nextStep;
        }
        catch(error: unknown) {
            showAlertMessage(`Error from stepping: ${(error as Error).message}`, "structureReader");
        };
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

    running.value = !running.value;
};

/**
 * Set the file format to load
 */
const setFormat = (): void => {

    sendToNode(id, "formats", {format: format.value});

    fileToRead.value = "";
    countSteps.value = 1;
    step.value = 1;

    // Clean the labels of the file selectors
    label1.value = "";
    label2.value = "";
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

    sendToNode(id, "types", {atomsTypes: atomsTypes.value ?? ""});
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
 */
const selectedFile = (filename: string): void => {

    step.value = 1;
    fileToRead.value = filename;
    inProgress.value = true;

    askNode(id, "read", {
            format: format.value,
            fileToRead: filename,
            atomsTypes: atomsTypes.value,
            useBohr: useBohr.value,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            inProgress.value = false;
            setTimeout(() => {controlStore.reset = true;}, 20);
        })
        .catch((error: Error) => {
            inProgress.value = false;
            showAlertMessage(`Error from load file: ${error.message}`, "structureReader");
        });
};

// > Load auxiliary file
/**
 * Start loading a XDATCAR auxiliary file
 *
 * @param filename - Selected filename
 */
const selectedAuxFile = (filename: string): void => {

    askNode(id, "aux", {
            format: "XDATCAR",
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

    let filter: FileFilter[];
	switch(fileFormat) {
		case "CHGCAR":
			filter = [{name: "CHGCAR",	        extensions: ["chgcar"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "CEL":
			filter = [{name: "CEL",		        extensions: ["cel"]},
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
        default:
            filter = [{name: "All",	extensions: ["*"]}];
            break;
	}

    return JSON.stringify(filter);
};

/** The JSON encoded filter for XDATCAR auxiliary file */
const filterForXDATCAR = '[{"name":"XDATCAR","extensions":["xdatcar"]},{"name":"All","extensions":["*"]}]';

// To clear the select atoms labels
const label1 = ref("");
const label2 = ref("");

</script>


<template>
<v-container class="container">

  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4"
            density="compact" @update:model-value="setFormat" />

  <v-text-field v-if="needsAtomTypes(format)" v-model="atomsTypes"
                label="Atoms types"
                placeholder="Space separated list" class="mb-6"
                variant="solo-filled" hide-details="auto"
                clearable spellcheck="false"
                @blur="getAtomsTypes" @keyup.enter="getAtomsTypes"
                @click:clear="getAtomsTypes"/>

  <g-select-file v-model="label1" class="mt-2" :disabled="format === ''" title="Select input file"
                 :filter="filterFromFormat(format)" @selected="selectedFile" />

  <g-select-file v-if="format === 'POSCAR + XDATCAR'" v-model="label2" class="mt-2"
                 :filter="filterForXDATCAR"
                 title="Select XDATCAR file" @selected="selectedAuxFile"/>

  <v-switch v-else-if="format === 'Gaussian Cube'" v-model="useBohr" color="primary"
            label="Use Bohr units" density="compact" class="ml-2 mt-4" @update:model-value="setUseBohr" />
  <v-container v-if="countSteps > 1" class="ml-4 pa-0 mt-6 pt-4">
    <enable-capture />
    <v-row class="pl-3 mt-0">
      <v-switch v-model="loopSteps" color="primary" label="Loop" density="compact" class="mr-5" />
      <v-switch v-model="stepBackward" color="primary" label="Reverse" density="compact" />
      <v-number-input controlVariant="stacked" variant="solo-filled" density="compact" v-model="stepIncrement"
                      label="Step increment" :min="1" class="ml-3 mr-8" />
    </v-row>
    <v-label class="no-select pb-4 mt-4">{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" class="mr-9" />
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
