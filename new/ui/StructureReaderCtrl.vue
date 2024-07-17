<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref} from "vue";
// import {ref, watchEffect} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight,
        mdiChevronLeft, mdiChevronRight, mdiFileOutline} from "@mdi/js";
import {sb} from "../../src/services/Switchboard";
import {useMessageStore} from "../../src/stores/messageStore";
import {useControlStore} from "../../src/stores/controlStore";
import {askNode} from "../services/RoutesClient";
// import type {CtrlParams} from "../types";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.structureReader.message = "";

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

// > Get and set ui parameters from the switchboard
const fileToRead    = ref("");
const countSteps    = ref(1);
const step          = ref(1);
const running       = ref(false);
const atomsTypes    = ref("");
const loopSteps     = ref(false);
const format        = ref("");
const inProgress    = ref(false);
const captureMovie  = ref(false);
const auxInProgress = ref(false);
// const auxFileToRead = ref("");
const filesSelected = ref<File[]>([]);
const auxFileSelected = ref<File[]>([]);
const useBohr       = ref(true);

askNode(id, ":1")
    .then((params) => {
        console.log("Received in client", params);
    })
    .catch((error: Error) => console.log("ERROR!", error.message));
/*
sb.getUiParams(id, (params: CtrlParams) => {

    fileToRead.value    = params.fileToRead as string ?? "";
    countSteps.value    = params.steps as number ?? 1;
    step.value          = params.step as number ?? 1;
    running.value       = params.running as boolean ?? false;
    loopSteps.value     = params.loopSteps as boolean ?? false;
    format.value        = params.format as string ?? "";
    atomsTypes.value    = params.atomsTypes as string ?? "";
    inProgress.value    = params.inProgress as boolean ?? false;
    auxFileToRead.value = params.auxFileToRead as string ?? "";
    auxInProgress.value = params.auxInProgress as boolean ?? false;
    useBohr.value       = params.useBohr as boolean ?? true;

    let file = JSON.parse(params.filesSelectedFull as string ?? "{}") as File;
    if("path" in file) filesSelected.value[0] = file;

    file = JSON.parse(params.auxSelectedFull as string ?? "{}") as File;
    if("path" in file) auxFileSelected.value[0] = file;
});

watchEffect(() => {

    sb.setUiParams(id, {
        step: step.value,
        running: running.value,
        loopSteps: loopSteps.value,
        format: format.value,
        fileToRead: fileToRead.value,
        useBohr: useBohr.value,
    });
});
*/
/**
 * Start and stop capture of a movie of the sequence
 *
 * @param capture - The running value (true starts capture, false stop it)
 */
const setCaptureMovie = (capture: boolean): void => {

    if(captureMovie.value) {

        controlStore.movie = capture;
    }
};

/**
 * Set the running status
 *
 * @param value - The running value to set
 */
const setRunning = (value: boolean): void => {

    setCaptureMovie(value);

    running.value = value;
    sb.setUiParams(id, {
        running: value,
        loopSteps: loopSteps.value
    });
};

/**
 * Manually change the step visualized
 *
 * @param value - New step value
 */
const setStep = (value: number): void => {

    step.value = value;
    sb.setUiParams(id, {
        step: value
    });
};

/**
 * Change the current step by delta steps
 *
 * @param delta - How many steps the current one should move
 */
const deltaStep = (delta: number): void => {

    const changedStep = step.value + delta;
    if(changedStep < 1 || changedStep > countSteps.value) return;
    step.value = changedStep;
    sb.setUiParams(id, {
        step: changedStep
    });
};

/**
 * Start/stop automatic play of steps
 */
const togglePlay = (): void => {

    if(running.value) setRunning(false);
    else if(step.value < countSteps.value) setRunning(true);
    else if(loopSteps.value) {
        step.value = 1;
        setRunning(true);
    }
};

/**
 * Set the file format to load
 */
const setFormat = (): void => {

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

    const isArray = Array.isArray(files);
    if(!files || (isArray && files.length === 0)) return;
    const file = isArray ? files[0] : files;

    step.value = 1;
    fileToRead.value = file.path;

    sb.setUiParams(id, {
        fileToRead: file.path,
        filesSelectedFull: JSON.stringify({name: file.name, path: file.path}),
        step: 1,
    });
};

// > Load auxiliary file
/**
 * Start loading an auxiliary file
 *
 * @param files - Output of the file selector
 */
const loadAuxFile = (files: File[] | File): void => {

    const isArray = Array.isArray(files);
    if(!files || (isArray && files.length === 0)) return;
    const file = isArray ? files[0] : files;

    sb.setUiParams(id, {
        auxFileToRead: file.path,
        auxSelectedFull: JSON.stringify({name: file.name, path: file.path}),
    });
};

/**
 * Get field value on blur or ENTER pressed
 */
const getAtomsTypes = (): void => {

    sb.setUiParams(id, {
        atomsTypes: atomsTypes.value,
    });
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
                :disabled="format===''"
                :prepend-icon="mdiFileOutline" :accept="acceptFile(format)" :clearable="false"
                class="mt-2" @update:model-value="loadFile" />

  <v-file-input v-if="format==='POSCAR + XDATCAR'" v-model="auxFileSelected"
                label="Select XDATCAR file" :loading="auxInProgress"
                :prepend-icon="mdiFileOutline" accept=".xdatcar,*" :clearable="false"
                class="mt-0" @update:model-value="loadAuxFile" />
  <v-switch v-else-if="format === 'Gaussian Cube'" v-model="useBohr" color="primary"
                label="Use Bohr units" density="compact" class="ml-2" />
  <v-container v-if="countSteps > 1" class="ml-2 pa-0">
    <v-switch v-model="loopSteps" color="primary" label="Loop" density="compact" />
    <v-switch v-model="captureMovie" color="primary" label="Movie from steps" density="compact"
              class="mt-n5" />
    <v-switch v-if="controlStore.hasTrajectory" v-model="controlStore.trajectoriesRecording"
              color="primary" label="Record trajectories" density="compact" class="mt-n5" />
    <v-switch v-if="controlStore.hasFingerprints" v-model="controlStore.fingerprintsAccumulate"
              color="primary" label="Accumulate for fingerprinting" density="compact" class="mt-n5" />
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" class="mr-6" />
    <v-row class="mr-2">
      <v-spacer />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronDoubleLeft" class="mr-1"
              @click="setStep(1)" />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronLeft" class="mr-1"
              @click="deltaStep(-1)" />
      <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay" class="mr-1"
              @click="togglePlay" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronRight" class="mr-1"
              @click="deltaStep(1)" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronDoubleRight"
              @click="setStep(countSteps); setRunning(false)" />
      <v-spacer />
    </v-row>
  </v-container>
  <v-alert v-if="messageStore.structureReader.message !== ''" title="Error" class="mt-7 cursor-pointer"
           :text="messageStore.structureReader.message" type="error" density="compact"
           color="red" @click="messageStore.structureReader.message=''" />
</v-container>
</template>
