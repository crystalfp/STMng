<script setup lang="ts">

import {ref} from "vue";
import {readStructure} from "@/services/RoutesClient";
import type {ReaderStructure} from "@/types";
import {mdiPlay, mdiStop, mdiChevronDoubleLeft, mdiChevronDoubleRight} from "@mdi/js";

const fileRead = ref("");
const countSteps = ref(1);
const step = ref(1);

const askFile = (): void => {
    readStructure()
        .then((structureRaw) => {
            const structure = JSON.parse(structureRaw) as ReaderStructure;

            if(structure.error) throw Error(structure.error);
            fileRead.value = structure.filename;
            countSteps.value = structure.structures.length;
        })
        .catch((error: Error) => {fileRead.value = error.message;});
};

let intervalId: ReturnType<typeof setInterval>;
const running = ref(false);

const stopPlay = (): void => {

    if(running.value) {
        clearInterval(intervalId);
        running.value = false;
    }
};

const togglePlay = (): void => {

    if(running.value) {
        clearInterval(intervalId);
        running.value = false;
    }
    else if(step.value < countSteps.value) {
        running.value = true;
        intervalId = setInterval(() => {
            ++step.value;
            if(step.value === countSteps.value) {
                clearInterval(intervalId);
                running.value = false;
            }
        }, 500);
    }
};

</script>


<template>
<v-container class="container">
  <v-row>
    <v-btn @click="askFile">Select file</v-btn>
    <v-label class="reader-filename">{{ fileRead }}</v-label>
  </v-row>
  <v-container v-if="countSteps > 1">
    <v-label>{{ `Step ${step}/${countSteps}` }}</v-label>
    <v-slider v-model="step" min="1" :max="countSteps" step="1" />
    <v-row>
      <v-btn variant="tonal" :icon="mdiChevronDoubleLeft" @click="step=1" />
      <v-btn variant="tonal" :icon="running ? mdiStop : mdiPlay" @click="togglePlay" />
      <v-btn variant="tonal" :icon="mdiChevronDoubleRight" @click="step=countSteps; stopPlay()" />
    </v-row>
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
