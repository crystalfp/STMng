<script setup lang="ts">

import {ref} from "vue";
import {readStructure} from "@/services/RoutesClient";
import type {ReaderStructure} from "@/types";

const fileRead = ref("");
const askFile = (): void => {
    readStructure()
        .then((structureRaw) => {
            const structure = JSON.parse(structureRaw) as ReaderStructure;

            if(structure.error) throw Error(structure.error);
            fileRead.value = structure.filename;
        })
        .catch((error: Error) => {fileRead.value = error.message;});
};

</script>


<template>
<v-container class="container">
  <v-row>
    <v-btn @click="askFile">Select file</v-btn>
    <v-label class="reader-filename">{{ fileRead }}</v-label>
  </v-row>
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
