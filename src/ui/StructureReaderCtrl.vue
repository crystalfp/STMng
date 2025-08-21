<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-16
 */

import {ref, watch, computed} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight,
        mdiChevronLeft, mdiChevronRight} from "@mdi/js";
import {askNode, sendToNode} from "@/services/RoutesClient";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import type {FileFilter} from "@/types";

import EnableCapture from "@/components/EnableCapture.vue";
import SelectFile from "@/widgets/SelectFile.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";
import TitledSlot from "@/widgets/TitledSlot.vue";

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
    "PDB",
    "POSCAR",
    "POSCAR + ENERGY",
    "POSCAR + XDATCAR",
    "Quantum ESPRESSO",
    "Shel-X",
    "XDATCAR5",
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
const speed         = ref(1);       // Animation speed: 0: no delay; 1: delay 200ms; 2: delay 400ms
const readHydrogen  = ref(false);   // Read also hydrogen atoms for the PDB reader
const energyPerAtom = ref(false);   // Energy file has energy per atom and not per structure
const appendFile    = ref(false);   // The file will be appended to the list of steps

const controlStore = useControlStore();
const configStore  = useConfigStore();

// Initialize the control
resetNodeAlert();
askNode(id, "init")
    .then((params) => {

        loopSteps.value     = params.loopSteps as boolean ?? false;
        stepBackward.value  = params.stepBackward as boolean ?? false;
        format.value        = params.format as string ?? "";
        atomsTypes.value    = params.atomsTypes as string ?? "";
        useBohr.value       = params.useBohr as boolean ?? true;
        readHydrogen.value  = params.readHydrogen as boolean ?? false;
        fileToRead.value    = params.fileToRead as string ?? "";
        auxFileToRead.value = params.auxFileToRead as string ?? "";
        stepIncrement.value = params.stepIncrement as number ?? 1;
        speed.value         = params.speed as number ?? 1;
        energyPerAtom.value = params.energyPerAtom as boolean ?? false;
    })
    .catch((error: Error) => showNodeAlert(`Error from UI init for ${label}: ${error.message}`, "structureReader"));

// Reset accumulate for fingerprint when changing to a single step structure
watch([countSteps], (after: [number], before: [number]) => {

    if(before[0] > 1 && after[0] === 1) controlStore.fingerprintsAccumulate = false;
});

// Manage the step selection
watch([step], (
       after:  [number],
       before: [number]) => {

    if(running.value || before[0] === after[0]) return;

    askNode(id, "step", {
            step: step.value,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            if(configStore.camera.autoReset) setTimeout(() => {controlStore.reset = true;}, 20);
        })
        .catch((error: Error) => {
            showNodeAlert(`Error from stepping: ${error.message}`, "structureReader");
        });
});

// Manage the running step
watch([running], async () => {

    let isRunning = running.value;

    while(isRunning) {

        let nextStep = step.value;

        if(stepBackward.value) {

            // Steps backward
            nextStep -= stepIncrement.value;

            if(nextStep === 1) {

                if(loopSteps.value) nextStep = countSteps.value;
                else isRunning = false;
            }
            else if(nextStep < 1) {
                if(loopSteps.value) nextStep = countSteps.value;
                else {
                    nextStep += stepIncrement.value;
                    isRunning = false;
                }
            }
        }
        else {

            // Steps forward
            nextStep += stepIncrement.value;

            if(nextStep === countSteps.value) {

                if(loopSteps.value) nextStep = 1;
                else isRunning = false;
            }
            else if(nextStep > countSteps.value) {

                if(loopSteps.value) nextStep = 1;
                else {
                    nextStep -= stepIncrement.value;
                    isRunning = false;
                }
            }
        }

        // Delay between steps: 0: no delay; 1: delay 200ms; 2: delay 400ms
        if(speed.value === 1) await new Promise((resolve) => setTimeout(resolve, 200));
        else if(speed.value === 2) await new Promise((resolve) => setTimeout(resolve, 400));

        try {
            const response = await askNode(id, "step", {step: nextStep});
            if("error" in response) throw Error(response.error as string);
            step.value = response.step as number;
            if(configStore.camera.autoReset) setTimeout(() => {controlStore.reset = true;}, 20);
            if(!running.value) break;
        }
        catch(error: unknown) {
            showNodeAlert(`Error from stepping: ${(error as Error).message}`, "structureReader");
        }
    }

    running.value = false;
});

watch([loopSteps, stepIncrement, stepBackward, speed], () => {

    sendToNode(id, "step-ctrl", {
        loopSteps: loopSteps.value,
        stepIncrement: stepIncrement.value,
        stepBackward: stepBackward.value,
        speed: speed.value
    });
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
const formatsThatNeedsAtomTypes = new Set(["POSCAR",
                                           "CHGCAR",
                                           "LAMMPS",
                                           "LAMMPStrj",
                                           "POSCAR + XDATCAR",
                                           "POSCAR + ENERGY",
                                           "XDATCAR5"]);

/**
 * Check if the format needs the atom types
 *
 * @param fileFormat - The format to check
 * @returns The check result
 */
const needsAtomTypes = (fileFormat: string): boolean => formatsThatNeedsAtomTypes.has(fileFormat);

/**
 * Get atoms types field value on blur or ENTER pressed.
 * If field empty return to default atoms types
 */
const getAtomsTypes = (): void => {

    resetNodeAlert();

    sendToNode(id, "types", {atomsTypes: atomsTypes.value});
};

/**
 * On change of the measurement unit
 */
const setUseBohr = (): void => {

    sendToNode(id, "bohr", {useBohr: useBohr.value});
};
/**
 * On change of the measurement unit
 */
const setReadHydrogen = (): void => {

    sendToNode(id, "hydrogen", {readHydrogen: readHydrogen.value});
};

/**
 * On change of the energy per atom in file
 */
const setEnergyPerAtom = (): void => {

    sendToNode(id, "per-atom", {energyPerAtom: energyPerAtom.value});
};

/**
 * On change of the append file status
 */
const setAppendFile = (): void => {

    sendToNode(id, "append", {appendFile: appendFile.value});
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
    resetNodeAlert();

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
            appendFile.value = false;
        })
        .catch((error: Error) => {
            inProgress.value = false;
            showNodeAlert(`Error from load file: ${error.message}`, "structureReader");
        });
};

// > Load auxiliary file
/**
 * Start loading an auxiliary file
 *
 * @param filename - Selected auxiliary filename
 */
const selectedAuxFile = (filename: string): void => {

    askNode(id, "aux", {
            format: format.value,
            auxFileToRead: filename,
        })
        .then((params) => {
            if("error" in params) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
        })
        .catch((error: Error) => {
            showNodeAlert(`Error loading auxiliary file: ${error.message}`, "structureReader");
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
    	case "PDB":
			filter = [{name: "PDB",	            extensions: ["pdb"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "POSCAR":
		case "POSCAR + XDATCAR":
        case "POSCAR + ENERGY":
			filter = [{name: "POSCAR",	        extensions: ["poscar", "poscars", "contcar"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "Quantum ESPRESSO":
			filter = [{name: "Quantum ESPRESSO", extensions: ["in"]},
					  {name: "All",		         extensions: ["*"]}];
            break;
		case "Shel-X":
			filter = [{name: "Shel-X",	        extensions: ["res", "ins"]},
					  {name: "All",		        extensions: ["*"]}];
            break;
		case "XDATCAR5":
			filter = [{name: "XDATCAR5",		extensions: ["xdatcar", "xdatcar5"]},
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

// To clear the select atoms labels
const label1 = ref("");
const label2 = ref("");

/** Data for formats that have an auxiliary file */
const auxSetup = computed(() => {

    switch(format.value) {
        case "POSCAR + ENERGY":
            return {
                hasAux: true,
                title: "Select ENERGY file",
                filter: '[{"name":"ENERGY","extensions":["energy","enthalpy"]},{"name":"All","extensions":["*"]}]',
            };
        case "POSCAR + XDATCAR":
            return {
                hasAux: true,
                title: "Select XDATCAR file",
                filter: '[{"name":"XDATCAR","extensions":["xdatcar"]},{"name":"All","extensions":["*"]}]',
            };
        default:
            return {
                hasAux: false,
                title: "",
                filter: "",
            };
    }
});

</script>


<template>
<v-container class="container">

  <v-select v-model="format" label="File format"
            :items="fileFormats" class="mt-4 mb-4"
            @update:model-value="setFormat" />

  <v-text-field v-if="needsAtomTypes(format)" v-model="atomsTypes"
                label="Atoms types"
                placeholder="Space separated list" class="mb-6"
                hide-details="auto"
                clearable spellcheck="false"
                @blur="getAtomsTypes" @keyup.enter="getAtomsTypes"
                @click:clear="getAtomsTypes"/>

  <v-switch v-model="appendFile"
            label="Append" class="ml-4 mt-4 mb-3"
            @update:model-value="setAppendFile" />

  <select-file v-model="label1" class="mt-2" :disabled="format === ''" title="Select input file"
               :filter="filterFromFormat(format)" @selected="selectedFile" />

  <v-switch v-if="format === 'POSCAR + ENERGY'" v-model="energyPerAtom"
            label="File has energy per atom" class="ml-4 mt-4 mb-3"
            @update:model-value="setEnergyPerAtom" />

  <select-file v-if="auxSetup.hasAux" v-model="label2" class="mt-2"
                 :filter="auxSetup.filter"
                 :title="auxSetup.title" @selected="selectedAuxFile"/>

  <v-switch v-else-if="format === 'Gaussian Cube'" v-model="useBohr"
            label="Use Bohr units" class="ml-4 mt-4" @update:model-value="setUseBohr" />
  <v-switch v-else-if="format === 'PDB'" v-model="readHydrogen"
            label="Read hydrogens" class="ml-4 mt-4" @update:model-value="setReadHydrogen" />
  <v-container v-if="countSteps > 1" class="ml-4 pa-0 mt-6 pt-4">
    <enable-capture />
    <v-row class="pl-3 mt-0">
      <v-switch v-model="loopSteps" label="Loop" class="mr-5 mb-6" />
      <v-switch v-model="stepBackward" label="Reverse" class="mb-6" />
      <v-number-input v-model="stepIncrement" label="Step increment" :min="1"
                      :precision="0" class="ml-3 mr-8" />
    </v-row>
    <v-label class="no-select pb-4 mt-4">{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" class="mr-9"
              :style="{visibility: speed===0? 'hidden' : 'visible'}"/>
    <v-row class="mr-4">
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

    <titled-slot title="Speed:" inline class="mt-10 mb-6 ml-0">
      <v-btn-toggle v-model="speed" mandatory>
        <v-btn>Fast</v-btn>
        <v-btn>Medium</v-btn>
        <v-btn>Slow</v-btn>
      </v-btn-toggle>
    </titled-slot>

  </v-container>
  <node-alert node="structureReader" />
</v-container>
</template>
