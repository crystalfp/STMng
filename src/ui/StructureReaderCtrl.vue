<script setup lang="ts">
/**
 * @component
 * Controls for the structure data reader.
 */

import {ref, watchEffect} from "vue";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight} from "@mdi/js";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;

    /** From where comes the module input (ignored here) */
    in: string;
}>();

// > Get and set ui parameters from the switchboard
const fileRead   = ref("");
const format     = ref("");
const countSteps = ref(1);
const step       = ref(1);
const running    = ref(false);
const loading    = ref(false);
const atomsTypes = ref("");

sb.getUiParams(props.id, (params: UiParams) => {

    fileRead.value   = params.filename as string ?? "";
    format.value     = params.format as string ?? "";
    countSteps.value = params.steps as number ?? 1;
    step.value       = params.step as number ?? 1;
    running.value    = params.running as boolean ?? false;
    loading.value    = params.loading as boolean ?? false;
});

watchEffect(() => {
    sb.setUiParams(props.id, {
        step: step.value,
        running: running.value,
        loading: loading.value
    });
});


const loadFile = (): void => {

    loading.value = true;
    sb.setUiParams(props.id, {
        loading: true
    });
};

const setRunning = (value: boolean): void => {

    running.value = value;
    sb.setUiParams(props.id, {
        running: value
    });
};

const setStep = (value: number): void => {

    step.value = value;
    sb.setUiParams(props.id, {
        step: value
    });
};

const togglePlay = (): void => {

    if(running.value) setRunning(false);
    else if(step.value < countSteps.value) setRunning(true);
};

</script>


<template>
<v-container class="container">
  <v-row>
    <v-btn @click="loadFile">Select file</v-btn>
    <v-label class="reader-filename">{{ fileRead }}</v-label>
  </v-row>
  <v-container v-if="countSteps > 1">
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" />
    <v-row>
      <v-spacer />
      <v-btn variant="tonal" :icon="mdiChevronDoubleLeft" @click="setStep(1)" />
      <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay" @click="togglePlay" />
      <v-btn variant="tonal" :icon="mdiChevronDoubleRight" @click="setStep(countSteps); setRunning(false)" />
      <v-spacer />
    </v-row>
  </v-container>
  <v-container v-if="format === 'POSCAR'">
    <v-text-field v-model="atomsTypes" label="Atoms types" variant="solo-filled" hide-details="auto" clearable />
  </v-container>
</v-container>
</template>


<style scoped lang="scss">

@use "@/styles/colors";
@use "@/styles/fonts";

.reader-filename {
  margin-left: 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), var(--v-border-opacity));
  width: 60%
}
</style>
