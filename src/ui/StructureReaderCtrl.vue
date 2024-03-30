<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref, watchEffect} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight,
        mdiChevronLeft, mdiChevronRight} from "@mdi/js";
import {sb, type UiParams} from "@/services/Switchboard";
import {useMessageStore} from "@/stores/messageStore";
import {useConfigStore} from "@/stores/configStore";

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.structureReader.message = "";

// Access the global control area
const configStore = useConfigStore();

/** Formats that could be loaded */
const fileFormats = ["CHGCAR", "CIF", "LAMMPS", "LAMMPStrj", "POSCAR", "Shel-X", "XYZ"];

// > Get and set ui parameters from the switchboard
const fileRead     = ref("");
const countSteps   = ref(1);
const step         = ref(1);
const running      = ref(false);
const doLoad       = ref(false);
const atomsTypes   = ref("");
const loopSteps    = ref(false);
const format       = ref("");
const inProgress   = ref(false);
const captureMovie = ref(false);

sb.getUiParams(pr.id, (params: UiParams) => {

    fileRead.value     = params.filename as string ?? "";
    countSteps.value   = params.steps as number ?? 1;
    step.value         = params.step as number ?? 1;
    running.value      = params.running as boolean ?? false;
    doLoad.value       = params.doLoad as boolean ?? false;
    loopSteps.value    = params.loopSteps as boolean ?? false;
    format.value       = params.format as string ?? "";
    atomsTypes.value   = params.atomsTypes as string ?? "";
    inProgress.value   = params.inProgress as boolean ?? false;
});

watchEffect(() => {
    sb.setUiParams(pr.id, {
        step: step.value,
        running: running.value,
        doLoad: doLoad.value,
        loopSteps: loopSteps.value,
        format: format.value,
        atomsTypes: atomsTypes.value,
        filename: fileRead.value,
    });
});

/**
 * Start loading a file
 */
const loadFile = (): void => {

    doLoad.value = true;
    step.value = 1;
    sb.setUiParams(pr.id, {
        doLoad: true,
        step: 1,
    });
};

/**
 * Start and stop capture of a movie of the sequence
 *
 * @param capture - The running value (true starts capture, false stop it)
 */
const setCaptureMovie = (capture: boolean): void => {

    if(captureMovie.value) {
        // const configStore = useConfigStore();
        configStore.control.movie = capture;
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
    sb.setUiParams(pr.id, {
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
    sb.setUiParams(pr.id, {
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
    sb.setUiParams(pr.id, {
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
 *
 * @param changedFormat - The new format to load
 */
const setFormat = (changedFormat: string): void => {

    format.value = changedFormat;
    fileRead.value = "";
    countSteps.value = 1;
    step.value = 1;
};

const formatsThatNeedsAtomTypes = new Set(["POSCAR", "CHGCAR", "LAMMPS", "LAMMPStrj"]);
/**
 * Check if the format needs the atom types
 *
 * @param fileFormat - The format to check
 * @returns The check result
 */
const needsAtomTypes = (fileFormat: string): boolean => {
    return formatsThatNeedsAtomTypes.has(fileFormat);
};

</script>


<template>
<v-container class="container">
  <v-row class="mt-4 mb-2">
    <v-menu open-on-hover>
      <template #activator="{props}">
        <v-btn class="w-25 ml-3" size="small" color="primary" v-bind="props">
          Format
        </v-btn>
      </template>
      <v-list>
        <v-list-item v-for="fmt in fileFormats" :key="fmt">
          <v-list-item-title style="cursor: pointer" @click="setFormat(fmt)">{{ fmt }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-label class="underlined-label">{{ format }}</v-label>
  </v-row>
  <v-container v-if="needsAtomTypes(format)" class="pl-0 mb-5 pt-3">
    <v-text-field v-model="atomsTypes" label="Atoms types"
                  placeholder="Space separated list"
                  variant="solo-filled" hide-details="auto" clearable />
  </v-container>
  <v-row>
    <v-btn :disabled="format === ''" :loading="inProgress" class="w-25 ml-3" size="small" @click="loadFile">
      Load
    </v-btn>
    <v-label class="underlined-label">{{ fileRead }}</v-label>
  </v-row>
  <v-container v-if="countSteps > 1">
    <v-switch v-model="loopSteps" color="primary" label="Loop" density="compact" class="mt-4 ml-2" />
    <v-switch v-model="captureMovie" color="primary" label="Movie from steps" density="compact" class="mt-n5 ml-2" />
    <v-switch v-if="configStore.control.hasFingerprints" v-model="configStore.control.fingerprintsAccumulate"
              color="primary" label="Accumulate for fingerprinting" density="compact" class="mt-n5 ml-2" />
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" />
    <v-row>
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


<style scoped>

.show-symmetry {
  overflow-wrap: break-word;
  white-space: break-spaces;
  font-family: monospace;
}

</style>
