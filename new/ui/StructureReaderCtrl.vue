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
        mdiChevronLeft, mdiChevronRight, mdiFileOutline} from "@mdi/js";
import {useControlStore} from "../stores/controlStore";
import {askNode, sendToNode, receiveFromNode} from "../services/RoutesClient";
import {showAlertMessage, resetAlertMessage,
        hasAlertMessage, getAlertMessage} from "../services/AlertMessage";
import type {CtrlParams} from "../types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the global control area
const controlStore = useControlStore();

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
const fileToRead      = ref("");            // Path of the file to be read
const countSteps      = ref(1);             // Total steps read
const step            = ref(1);             // Current step
const running         = ref(false);         // The steps are playing
const atomsTypes      = ref("");            // Atom types in the structure read
const loopSteps       = ref(false);         // If the sequence should loop
const format          = ref("");            // File format to be read
const inProgress      = ref(false);         // True during file load
const captureMovie    = ref(false);
const auxInProgress   = ref(false);         // True during aux file load
const auxFileToRead   = ref("");            // Path to the auxiliary file to read
const filesSelected   = ref<File[]>([]);    // Status of the file selector
const auxFileSelected = ref<File[]>([]);    // Status of the aux file selector
const useBohr         = ref(true);          // Use Bohr units

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

        let file = JSON.parse(params.filesSelectedFull as string ?? "{}") as File;
        if("path" in file) filesSelected.value[0] = file;

        file = JSON.parse(params.auxSelectedFull as string ?? "{}") as File;
        if("path" in file) auxFileSelected.value[0] = file;
    })
    .catch((error: Error) => showAlertMessage(`Error from ask node: ${error.message}`, "structureReader"));

// Manage the steps selection
watch([step, running, loopSteps], () => {

    askNode(id, "step", {
        step: step.value,
        running: running.value,
        loopSteps: loopSteps.value,
    })
    .then((params) => {
        running.value = params.running as boolean ?? false;
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

/** Accept string for each file format */
const acceptStringByFormat = new Map<string, string>([
    ["CHGCAR",            ".chgcar,*"],
    ["CIF",               ".cif,*"],
    ["Gaussian Cube",     ".cube,*"],
    ["LAMMPS",            ".lmp,*"],
    ["LAMMPStrj",         ".lammpstrj,*"],
    ["POSCAR",            ".poscar,.poscars,*"],
    ["POSCAR + XDATCAR",  ".poscar,.poscars,*"],
    ["Shel-X",            ".res,.ins,*"],
    ["XYZ",               ".xyz,*"],
]);

/**
 * Create the accept string for the given format
 *
 * @param fileFormat - Format to be loaded
 * @returns The accept string for the file selector
 */
const acceptFile = (fileFormat: string): string => acceptStringByFormat.get(fileFormat) ?? "*";

/**
 * Start loading a file
 *
 * @param files - Output of the file selector
 */
const loadFile = (files: File[] | File): void => {

    if(!files) return;
    const isArray = Array.isArray(files);
    if(isArray && files.length === 0) return;
    const file = isArray ? files[0] : files;

    step.value = 1;
    fileToRead.value = file.path;
    inProgress.value = true;

    askNode(id, "read", {
            format: format.value,
            fileToRead: file.path,
            filesSelectedFull: JSON.stringify(file),
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
 * @param files - Output of the file selector
 */
const loadAuxFile = (files: File[] | File): void => {

    if(!files) return;
    const isArray = Array.isArray(files);
    if(isArray && files.length === 0) return;
    const file = isArray ? files[0] : files;

	auxInProgress.value = true;

    askNode(id, "aux", {
            format: format.value,
            auxFileToRead: file.path,
            auxSelectedFull: JSON.stringify(file),
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            auxInProgress.value = false;
        })
        .catch((error: Error) => {
            auxInProgress.value = false;
            showAlertMessage(`Error from load aux file: ${error.message}`, "structureReader");
        });
};

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

  <v-file-input v-model="filesSelected" label="Select input file" :loading="inProgress"
                :disabled="format === ''"
                :prepend-icon="mdiFileOutline" :accept="acceptFile(format)" :clearable="false"
                class="mt-2" @update:model-value="loadFile" />

  <v-file-input v-if="format === 'POSCAR + XDATCAR'" v-model="auxFileSelected"
                label="Select XDATCAR file" :loading="auxInProgress"
                :prepend-icon="mdiFileOutline" accept=".xdatcar,*" :clearable="false"
                class="mt-0" @update:model-value="loadAuxFile" />
  <v-switch v-else-if="format === 'Gaussian Cube'" v-model="useBohr" color="primary"
                label="Use Bohr units" density="compact" class="ml-2" @update:model-value="setUseBohr" />
  <v-container v-if="countSteps > 1" class="ml-2 pa-0">
    <v-switch v-model="loopSteps" color="primary" label="Loop" density="compact" />
    <v-switch v-if="controlStore.hasCapture" v-model="captureMovie"
              color="primary" label="Movie from steps" density="compact" class="mt-n5" />
    <v-switch v-if="controlStore.hasTrajectory" v-model="controlStore.trajectoriesRecording"
              color="primary" label="Record trajectories" density="compact" class="mt-n5" />
    <v-switch v-if="controlStore.hasFingerprints" v-model="controlStore.fingerprintsAccumulate"
              color="primary" label="Accumulate for fingerprinting" density="compact" class="mt-n5" />
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
  <v-alert v-if="hasAlertMessage('structureReader')" title="Error" class="mt-7 cursor-pointer"
           :text="getAlertMessage('structureReader')" type="error" density="compact"
           color="red" @click="resetAlertMessage('structureReader')" />
</v-container>
</template>
