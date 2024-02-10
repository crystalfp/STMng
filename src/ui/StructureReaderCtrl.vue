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

// > Properties
const pr = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Access the message store
const messageStore = useMessageStore();
messageStore.structureReader.message = "";

/** Formats that could be loaded */
const fileFormats = ["POSCAR", "ShelX", "XYZ"];

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

const setRunning = (value: boolean): void => {

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

</script>


<template>
<v-container class="container">
  <v-row class="mt-4 mb-2">
    <v-menu open-on-hover>
      <template #activator="{ props }">
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
  <v-container v-if="format === 'POSCAR'" class="pl-0 mb-5 pt-3">
    <v-text-field v-model="atomsTypes" label="Atoms types"
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
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" />
    <v-row>
      <v-spacer />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronDoubleLeft"
              @click="setStep(1)" />
      <v-btn variant="tonal" :disabled="step === 1" :icon="mdiChevronLeft"
              @click="deltaStep(-1)" />
      <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay"
              @click="togglePlay" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronRight"
              @click="deltaStep(1)" />
      <v-btn variant="tonal" :disabled="step === countSteps" :icon="mdiChevronDoubleRight"
              @click="setStep(countSteps); setRunning(false)" />
      <v-spacer />
    </v-row>
  </v-container>
  <v-alert v-if="messageStore.structureReader.message !== ''" title="Error"
           :text="messageStore.structureReader.message" type="error" density="compact"
           color="red" style="cursor: pointer;" @click="messageStore.structureReader.message=''" />
</v-container>
</template>


<style scoped>

.underlined-label {
  margin-left: 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), var(--v-border-opacity));
  width: 60%
}
</style>
