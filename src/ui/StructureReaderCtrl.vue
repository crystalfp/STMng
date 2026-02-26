<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-16
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {ref, reactive, watch, computed, onUnmounted} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight,
        mdiChevronLeft, mdiChevronRight,
        mdiArrowExpandHorizontal} from "@mdi/js";
import {askNode, sendToNode} from "@/services/RoutesClient";
import {setFileInTitle} from "@/services/SetTitle";
import {showNodeAlert, resetNodeAlert} from "@/services/AlertMessage";
import {useControlStore} from "@/stores/controlStore";
import {useConfigStore} from "@/stores/configStore";
import {resetCamera} from "@/services/ResetCamera";
import type {DBType, FileFilter} from "@/types";

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
    {title: "CHGCAR",           value: "CHGCAR"},
    {title: "CIF",              value: "CIF"},
    {title: "DL_POLY HISTORY",  value: "DL_POLY HISTORY"},
    {title: "Gaussian Cube",    value: "Gaussian Cube"},
    {title: "LAMMPS",           value: "LAMMPS"},
    {title: "LAMMPStrj",        value: "LAMMPStrj"},
    {title: "PDB",              value: "PDB"},
    {title: "POSCAR",           value: "POSCAR"},
    {title: "POSCAR + CP2K",    value: "POSCAR + CP2K"},
    {title: "POSCAR + ENERGY",  value: "POSCAR + ENERGY"},
    {title: "POSCAR + XDATCAR", value: "POSCAR + XDATCAR"},
    {title: "Quantum ESPRESSO", value: "Quantum ESPRESSO"},
    {title: "Shel-X",           value: "Shel-X"},
    {title: "XDATCAR5",         value: "XDATCAR5"},
    {title: "XYZ",              value: "XYZ"},
    {type:  "divider"},
    {type:  "subheader",        title: "Special sources"},
    {title: "Prototypes",       value: "Prototypes"},
    {title: "Collection",       value: "Collection"},
];

/**
 * Collection entry for the autocomplete query
 * @notExported
 */
interface CollectionType {
    /** Title that appears in the widget (and the one searched over) */
    title: string;
    /** Corresponding fileID to load */
    id: string;
}

// > UI parameters
const countSteps      = ref(1);      // Total steps read
const step            = ref(1);      // Current step
const running         = ref(false);  // The steps are playing
const atomsTypes      = ref("");     // Atom types in the structure read
const loopSteps       = ref(false);  // If the sequence should loop
const stepBackward    = ref(false);  // Run steps backward
const format          = ref("");     // File format to be read
const inProgress      = ref(false);  // True during file load
const useBohr         = ref(true);   // Use Bohr units
const stepIncrement   = ref(1);      // How many steps skip every tick
const speed           = ref<0 | 1 | 2>(1); // Animation speed:
                                           // 0: no delay; 1: delay 200ms; 2: delay 400ms
const readHydrogen    = ref(false);  // Read also hydrogen atoms for the PDB reader
const energyPerAtom   = ref(false);  // Energy file has energy per atom and not per structure
const appendFile      = ref(false);  // The file will be appended to the list of steps
const stepRange       = ref([1, 1]); // Range of steps
const showPrototypes  = ref(false);  // If the read comes from the prototypes database
const showCollection  = ref(false);  // If the read comes from the structure collection
const db              = reactive<DBType[]>([]); // The prototypes db content for query
const query           = ref("");     // The selected prototype UID
const mineral         = ref("");     // The selected prototype mineral tag
const pearson         = ref("");     // The selected prototype pearson tag
const strukturbericht = ref("");     // The selected prototype strukturbericht tag
const aflowTag        = ref("");     // The selected prototype aflow tag
const collection      = ref<CollectionType[]>([]); // The structure collection
const collectionQuery = ref("");     // The selected collection entry ID

const controlStore = useControlStore();
const configStore  = useConfigStore();

/**
 * Batch read structure file
 */
const batchRead = async (): Promise<void> => {

    // Get the special switches
    const params = await askNode("SYSTEM", "SWITCHES");
    if(!params.inputFile) return;

    // If there is an input file
    countSteps.value = 1;
    step.value = 1;
    inProgress.value = true;
    resetNodeAlert();

    const readParams = await askNode(id, "read", {
        format: format.value,
        fileToRead: params.inputFile,
        atomsTypes: atomsTypes.value,
        useBohr: useBohr.value,
    });

    if(readParams.error) throw Error(readParams.error as string);
    countSteps.value = readParams.countSteps as number ?? 1;
    inProgress.value = false;
    resetCamera();
    appendFile.value = false;
    stepRange.value[0] = 1;
    stepRange.value[1] = countSteps.value;

    // Set filename in title
    const file = (params.inputFile as string).replaceAll("\\", "/");
    const pos = file.lastIndexOf("/");
    setFileInTitle(file.slice(pos+1));

    // If there is an auxiliary file
    if(!params.auxFile) return;

    const auxParams = await askNode(id, "aux", {
        format: format.value,
        auxFileToRead: params.auxFile,
    });
    if(auxParams.error) throw Error(auxParams.error as string);
    countSteps.value = auxParams.countSteps as number ?? 1;
    stepRange.value[0] = 1;
    stepRange.value[1] = countSteps.value;
};

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
        stepIncrement.value = params.stepIncrement as number ?? 1;
        speed.value         = params.speed as 0 | 1 | 2 ?? 1;
        energyPerAtom.value = params.energyPerAtom as boolean ?? false;
        const dbRaw = JSON.parse(params.db as string ?? "[]") as DBType[];
        db.length = 0;
        for(const entry of dbRaw) db.push(entry);

        // eslint-disable-next-line promise/no-nesting
        batchRead().catch((error: Error) => {
            showNodeAlert(`Error from batch read for ${label}: ${error.message}`,
                          "structureReader");
        });

        if(format.value === "Collection") {
            showCollection.value = true;
            showPrototypes.value = false;
        }
        else if(format.value === "Prototypes") {
            showCollection.value = false;
            showPrototypes.value = true;
        }
        else {
            showCollection.value = false;
            showPrototypes.value = false;
        }
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from UI init for ${label}: ${error.message}`,
                      "structureReader");
    });

// Reset accumulate for fingerprint when changing to a single step structure
const stopWatcher1 = watch([countSteps], (after: [number], before: [number]) => {

    if(before[0] > 1 && after[0] === 1) controlStore.fingerprintsAccumulate = false;
});

// Manage the step selection
const stopWatcher2 = watch([step], (
       after:  [number],
       before: [number]) => {

    if(running.value || before[0] === after[0]) return;

    askNode(id, "step", {
            step: step.value,
        })
        .then((params) => {
            if(params.error) throw Error(params.error as string);
            if(configStore.camera.autoReset) resetCamera();
        })
        .catch((error: Error) => {
            showNodeAlert(`Error from stepping: ${error.message}`, "structureReader");
        });
});

// Manage the running step
const stopWatcher3 = watch([running], async () => {

    let isRunning = running.value;

    while(isRunning) {

        let nextStep = step.value;

        if(stepBackward.value) {

            // Steps backward
            nextStep -= stepIncrement.value;

            if(nextStep === stepRange.value[0]) {

                if(loopSteps.value) nextStep = stepRange.value[1];
                else isRunning = false;
            }
            else if(nextStep < stepRange.value[0]) {
                if(loopSteps.value) nextStep = stepRange.value[1];
                else {
                    nextStep += stepIncrement.value;
                    isRunning = false;
                }
            }
        }
        else {

            // Steps forward
            nextStep += stepIncrement.value;

            if(nextStep === stepRange.value[1]) {

                if(loopSteps.value) nextStep = stepRange.value[0];
                else isRunning = false;
            }
            else if(nextStep > stepRange.value[1]) {

                if(loopSteps.value) nextStep = stepRange.value[0];
                else {
                    nextStep -= stepIncrement.value;
                    isRunning = false;
                }
            }
        }

        // Delay between steps: 0: no delay; 1: delay 200ms; 2: delay 400ms
        if(speed.value === 1) await new Promise((resolve) => {setTimeout(resolve, 200);});
        else if(speed.value === 2) await new Promise((resolve) => {setTimeout(resolve, 400);});

        try {
            const response = await askNode(id, "step", {step: nextStep});
            if(response.error) throw Error(response.error as string);
            step.value = response.step as number;
            if(configStore.camera.autoReset) resetCamera();
            if(!running.value) break;
        }
        catch(error: unknown) {
            showNodeAlert(`Error from stepping: ${(error as Error).message}`, "structureReader");
        }
    }

    running.value = false;
});

const stopWatcher4 = watch([loopSteps, stepIncrement, stepBackward, speed], () => {

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
    if(changedStep < stepRange.value[0] || changedStep > stepRange.value[1]) return;
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

    if(format.value === "Prototypes") {
        showPrototypes.value = true;
        showCollection.value = false;
        return;
    }
    if(format.value === "Collection") {
        askNode(id, "collection")
            .then((result) => {

                collection.value = JSON.parse(result.list as string ?? "[]") as CollectionType[];
                showPrototypes.value = false;
                showCollection.value = true;
            })
            .catch((error: Error) => {
                showNodeAlert(`Error loading collection: ${error.message}`,
                              "structureReader");
            });
        return;
    }
    showPrototypes.value = false;
    showCollection.value = false;
    countSteps.value = 0;

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
                                           "POSCAR + CP2K",
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
    if(atomsTypes.value === null || atomsTypes.value === "") return;
    sendToNode(id, "types", {atomsTypes: atomsTypes.value});
};

/**
 * On change of the measurement unit
 */
const setUseBohr = (): void => {

    sendToNode(id, "bohr", {useBohr: useBohr.value});
};

/**
 * On change of the read hydrogen
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

    if(appendFile.value) {

        // Clean the labels of the file selectors
        label1.value = "";
        label2.value = "";
    }
    sendToNode(id, "append", {appendFile: appendFile.value});
};

// > Load structure file
/**
 * Start loading a structure file
 *
 * @param filename - Selected filename
 */
const selectedFile = (filename: string): void => {

    countSteps.value = 1;
    step.value = 1;
    inProgress.value = true;
    resetNodeAlert();

    askNode(id, "read", {
            format: format.value,
            fileToRead: filename,
            atomsTypes: atomsTypes.value,
            useBohr: useBohr.value,
        })
        .then((params) => {
            if(params.error) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            inProgress.value = false;
            resetCamera();
            appendFile.value = false;
            stepRange.value[0] = 1;
            stepRange.value[1] = countSteps.value;
        })
        .catch((error: Error) => {
            inProgress.value = false;
            showNodeAlert(`Error loading file: ${error.message}`, "structureReader");
        });
};

// > Drop structure file
/**
 * Start loading a dropped structure file
 *
 * @param content - Dropped file content
 */
const droppedFile = (content: string, filename: string): void => {

    step.value = 1;
    inProgress.value = true;
    resetNodeAlert();

    askNode(id, "read-dropped", {
            format: format.value,
            fileContent: content,
            atomsTypes: atomsTypes.value,
            useBohr: useBohr.value,
            filename
        })
        .then((params) => {
            if(params.error) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            inProgress.value = false;
            resetCamera();
            appendFile.value = false;
            stepRange.value[0] = 1;
            stepRange.value[1] = countSteps.value;
        })
        .catch((error: Error) => {
            inProgress.value = false;
            showNodeAlert(`Error loading dropped file: ${error.message}`, "structureReader");
        });
};

/**
 * Start loading a dropped auxiliary file
 *
 * @param content - Dropped file content
 */
const droppedAuxFile = (content: string): void => {

    askNode(id, "aux-dropped", {
            format: format.value,
            auxFileContent: content,
        })
        .then((params) => {
            if(params.error) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            stepRange.value[0] = 1;
            stepRange.value[1] = countSteps.value;
        })
        .catch((error: Error) => {
            showNodeAlert(`Error loading dropped auxiliary file: ${error.message}`, "structureReader");
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
            if(params.error) throw Error(params.error as string);
            countSteps.value = params.countSteps as number ?? 1;
            stepRange.value[0] = 1;
            stepRange.value[1] = countSteps.value;
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
			filter = [{name:       "CHGCAR",
                       extensions: ["chgcar"]}];
            break;
		case "CIF":
			filter = [{name:       "CIF",
                       extensions: ["cif"]}];
            break;
		case "DL_POLY HISTORY":
			filter = [{name:       "DL_POLY HISTORY",
                       extensions: ["history"]}];
            break;
    	case "Gaussian Cube":
			filter = [{name:       "Gaussian Cube",
                       extensions: ["cube"]}];
            break;
    	case "LAMMPS":
			filter = [{name:       "LAMMPS",
                       extensions: ["lmp"]}];
            break;
    	case "LAMMPStrj":
			filter = [{name:       "LAMMPStrj",
                       extensions: ["lammpstrj"]}];
            break;
    	case "PDB":
			filter = [{name:       "PDB",
                       extensions: ["pdb"]}];
            break;
		case "POSCAR":
		case "POSCAR + XDATCAR":
		case "POSCAR + CP2K":
        case "POSCAR + ENERGY":
			filter = [{name:       "POSCAR",
                       extensions: ["poscar", "poscars", "contcar", "vasp"]}];
            break;
		case "Quantum ESPRESSO":
			filter = [{name:       "Quantum ESPRESSO",
                       extensions: ["in"]}];
            break;
		case "Shel-X":
			filter = [{name:       "Shel-X",
                       extensions: ["res", "ins"]}];
            break;
		case "XDATCAR5":
			filter = [{name:       "XDATCAR5",
                       extensions: ["xdatcar", "xdatcar5"]}];
            break;
		case "XYZ":
			filter = [{name:       "XYZ",
                       extensions: ["xyz"]}];
            break;
        default:
            filter = [];
            break;
	}

    // Adding the default entry at the end
    filter.push({name: "All", extensions: ["*"]});

    return JSON.stringify(filter);
};

// To clear the select atoms labels
const label1 = ref("");
const label2 = ref("");

// Add loaded file to the window title
const stopWatcher5 = watch(label1, () => {setFileInTitle(label1.value);});

/** Data for formats that have an auxiliary file */
const auxSetup = computed(() => {

    switch(format.value) {
        case "POSCAR + ENERGY":
        case "POSCAR + CP2K":
            return {
                hasAux: true,
                title: "Select ENERGY file",
                label: "Select or drop ENERGY file",
                filter: '[{"name":"ENERGY","extensions":["energy","enthalpy"]},{"name":"All","extensions":["*"]}]',
            };
        case "POSCAR + XDATCAR":
            return {
                hasAux: true,
                title: "Select XDATCAR file",
                label: "Select or drop XDATCAR file",
                filter: '[{"name":"XDATCAR","extensions":["xdatcar"]},{"name":"All","extensions":["*"]}]',
            };
        default:
            return {
                hasAux: false,
                title: "",
                label: "",
                filter: "",
            };
    }
});

/**
 * Restore the original atom types from file if present
 * when cleaning the atom types field
 */
const clearAtomTypes = (): void => {

    resetNodeAlert();

    // Ignore uninformative response. Error is already handled in main
    askNode(id, "species")
        .catch((error: Error) => {
            showNodeAlert(`Error reloading file: ${error.message}`, "structureReader");
        });
};

/** Limit the step inside the step range */
const stopWatcher6 = watch(stepRange, () => {

    if(step.value < stepRange.value[0]) step.value = stepRange.value[0];
    else if(step.value > stepRange.value[1]) step.value = stepRange.value[1];
},
{deep: true});

/**
 * Reset the step range to the full count of steps
 */
const resetRange = (): void => {
    stepRange.value[0] = 1;
    stepRange.value[1] = countSteps.value;
};

/**
 * Load the queried prototype
 *
 * @param aflow - Selected aflow UID to display
 */
const startQuery = (aflow: string): void => {

    if(!aflow) aflow = "";
    else if(aflow.startsWith("#")) aflow = aflow.slice(3);

    // Retrieve prototype
    askNode(id, "proto", {aflow})
        .then((result) => {
            if(result.error) throw Error(result.error as string);
            mineral.value = result.mineral as string ?? "";
            aflowTag.value = aflow;
            strukturbericht.value = result.strukturbericht as string ?? "";
            pearson.value = result.pearson as string ?? "";
            resetCamera();
        })
        .catch((error: Error) => {
            showNodeAlert(error.message, "structureReader");
        });
};

/**
 * Load the queried collection item
 *
 * @param filename - Filename to load
 */
const startCollectionQuery = (fileID: string): void => {

    if(!fileID) fileID = "";
    askNode(id, "collection", {fileID})
        .then((result) => {
            if(result.error) throw Error(result.error as string);
        })
        .catch((error: Error) => {
            showNodeAlert(error.message, "structureReader");
        });
};

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
    stopWatcher3();
    stopWatcher4();
    stopWatcher5();
    stopWatcher6();
});

</script>


<template>
<v-container class="container">

  <v-select v-model="format" label="File format"
            :items="fileFormats" class="my-4 mr-2"
            @update:model-value="setFormat" />

  <v-container v-if="showPrototypes" class="pa-0">
    <v-autocomplete v-model="query" label="Prototype query" class="mr-2"
                  :items="db" item-title="title" item-value="aflow"
                  :auto-select-first="true" :hide-details="true"
                  :clearable="true" no-data-text="No prototype found" spellcheck="false"
                  @update:modelValue="startQuery"/>
    <v-label v-if="query" class="result-label bigger-result pb-1 mt-4 ml-4 mb-1" v-html="mineral" />
    <table v-if="query" class="ml-4 text-body-2">
      <tbody>
        <tr><td class="c1">aflow:</td><td>{{ aflowTag }}</td></tr>
        <tr><td class="c1">strukturbericht:</td><td v-html="strukturbericht.replace(/_([^_]+)$/, '<sub>$1</sub>')"/></tr>
        <tr><td class="c1">pearson:</td><td>{{ pearson }}</td></tr>
      </tbody>
    </table>
  </v-container>
  <v-container v-else-if="showCollection" class="pa-0">
    <v-autocomplete v-model="collectionQuery" label="Collection query" class="mr-2"
                  :items="collection" item-title="title" item-value="id"
                  :auto-select-first="true" :hide-details="true"
                  :clearable="true" no-data-text="No entry found" spellcheck="false"
                  @update:modelValue="startCollectionQuery"/>
  </v-container>
  <v-container v-else class="pa-0">

    <v-text-field v-if="needsAtomTypes(format)" v-model.trim="atomsTypes"
                  label="Atoms types"
                  placeholder="Space separated list" class="mb-6 mr-2"
                  hide-details="auto"
                  clearable spellcheck="false"
                  @blur="getAtomsTypes" @keyup.enter="getAtomsTypes"
                  @click:clear="clearAtomTypes"/>
    <v-switch v-model="appendFile"
              label="Append" class="ml-2 mt-4"
              @update:model-value="setAppendFile" />

    <select-file v-model="label1" :disabled="format === ''"
                label="Select or drop input file"
                title="Select input file"
                :filter="filterFromFormat(format)"
                @selected="selectedFile"
                @dropped="droppedFile" />

    <v-switch v-if="format === 'POSCAR + ENERGY'" v-model="energyPerAtom"
              label="File has energy per atom" class="ml-2 mt-2"
              @update:model-value="setEnergyPerAtom" />

    <select-file v-if="auxSetup.hasAux" v-model="label2"
                :filter="auxSetup.filter"
                :label="auxSetup.label"
                :title="auxSetup.title"
                @selected="selectedAuxFile"
                @dropped="droppedAuxFile" />

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
                        :precision="0" class="ml-3 mr-10" />
      </v-row>
      <v-row class="ml-0 d-flex ga-1 align-center">
        <v-label class="no-select pb-4 mt-4 flex-1-1">{{ `Step ${step}/${stepRange[1]-stepRange[0]+1}` }}</v-label>
        <v-label v-if="stepRange[0] > 1 || stepRange[1] < countSteps"
                class="no-select pb-4 mt-4">
                {{ `Range ${stepRange[0]} — ${stepRange[1]}` }}</v-label>
        <v-btn v-if="stepRange[0] > 1 || stepRange[1] < countSteps" variant="plain"
              class="mr-10" :icon="mdiArrowExpandHorizontal" @click="resetRange" />
      </v-row>
      <v-slider v-model="step" min="1" :max="countSteps" step="1" class="mr-9"
                :style="{visibility: speed===0? 'hidden' : 'visible'}"/>
      <v-range-slider v-model="stepRange" min="1" :max="countSteps" step="1" strict class="mr-9 mt-n6"/>
      <v-row class="mr-4">
        <v-spacer />
        <v-btn variant="tonal" :disabled="step <= stepRange[0]" :icon="mdiChevronDoubleLeft" class="mr-1"
                @click="step = stepRange[0]" />
        <v-btn variant="tonal" :disabled="step <= stepRange[0]" :icon="mdiChevronLeft" class="mr-1"
                @click="deltaStep(-1)" />
        <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay" class="mr-1"
                @click="togglePlay" />
        <v-btn variant="tonal" :disabled="step >= stepRange[1]" :icon="mdiChevronRight" class="mr-1"
                @click="deltaStep(1)" />
        <v-btn variant="tonal" :disabled="step >= stepRange[1]" :icon="mdiChevronDoubleRight"
                @click="step = stepRange[1]; running = false" />
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

  </v-container>
  <node-alert node="structureReader" class="mt-4"/>
</v-container>
</template>


<style scoped>
:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}

td :deep(sub) {
  position: relative;
  bottom: -0.2rem;
  font-size: 90%;
}

.c1 {
  width: 7.2rem;
  user-select: none;
  padding-bottom: 2px;
}

</style>
