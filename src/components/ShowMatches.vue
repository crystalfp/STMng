<script setup lang="ts">
/**
 * @component
 * Secondary window to show the results of the matchers
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-24
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {reactive, ref} from "vue";
import log from "electron-log";
import {askNode, closeWindow, requestData} from "@/services/RoutesClient";
import {showNodeAlert} from "@/services/AlertMessage";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";
import type {CtrlParams} from "@/types";

const windowPath = "/matches";
let id = "";

interface PrototypesMatch {
    aflow: string;
    title: string;
}

interface CollectionMatch {
    id: string;
    title: string;
    distance: number;
    color: string;
}
const prototypes = reactive<PrototypesMatch[]>([]);
const collection = reactive<CollectionMatch[]>([]);
const spaceGroup = ref("");
const formula    = ref("");

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    // Error handling
    if(params?.error) {
        log.error(`Error requesting data for "${windowPath}". Error: ${params.error as string}`);
        return;
    }

    id = params.id as string ?? "";

    const aflow = params.aflow as string[] ?? [];
    const titlePrototypes = params.titlePrototypes as string[] ?? [];

    let len = aflow.length;
    prototypes.length = 0;
    for(let i=0; i < len; ++i) {
        prototypes.push({
            aflow: aflow[i],
            title: titlePrototypes[i]
        });
    }

    const idCollection = params.idCollection as string[] ?? [];
    const titleCollection = params.titleCollection as string[] ?? [];
    const distance = params.distance as number[] ?? [];
    const color = params.color as string[] ?? [];

    len = idCollection.length;
    collection.length = 0;
    for(let i=0; i < len; ++i) {
        collection.push({
            id: idCollection[i],
            title: titleCollection[i],
            distance: distance[i],
            color: color[i]
        });
    }

    spaceGroup.value = params.spaceGroup as string ?? "";
    formula.value = params.formula as string ?? "";
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Display in a secondary window the corresponding structure
 *
 * @param IdOrAflow - Collection structure file ID or prototype Aflow UID
 * @param isCollection - True if the id comes from the collection results
 */
const selectResult = (idOrAflow: string, isCollection: boolean): void => {

    if(id === "") return;

    // Retrieve prototype
    askNode(id, "show", {id: idOrAflow, isCollection})
        .then((result) => {
            if(result.error) throw Error(result.error as string);
        })
        .catch((error: Error) => {
            showNodeAlert(error.message, "matchers");
        });
};

</script>


<template>
<v-app :theme>
<v-container class="matches-portal">
  <v-row class="matches-container">
    <v-col cols="4" class="flex-1-1-0 pr-6">
      <v-label class="text-headline-small no-select justify-center mt-n2 mb-2 w-100">Prototype matches</v-label>
      <v-container v-for="entry of prototypes" :key="entry.aflow" v-ripple
                  class="mb-3 ml-4 py-1 pl-2 border-thin rounded-lg cursor-pointer"
                  @click="selectResult(entry.aflow, false)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer" v-html="entry.title" /><br>
        <v-label class="bigger-result cursor-pointer">{{ `aflow: ${entry.aflow}` }}</v-label>
      </v-container>
    </v-col>
    <v-divider vertical thickness="6px" opacity="0.6"/>
    <v-col cols="5" class="flex-1-1-0 pr-4">
      <v-label class="text-headline-small no-select justify-center mt-n2 mb-2 w-100">Collection matches</v-label>
      <v-container v-for="entry of collection" :key="entry.id" v-ripple
                   class="mb-3 py-1 pl-2 ml-2 border-thin rounded-lg cursor-pointer"
                   @click="selectResult(entry.id, true)">
        <v-label class="result-label pb-1 bigger-result cursor-pointer" v-html="entry.title"/><br>
        <v-label class="bigger-result cursor-pointer mr-1">distance:</v-label>
        <v-label class="bigger-result cursor-pointer" :style="{color: entry.color!}">
            {{ entry.distance!.toFixed(4) }}</v-label>
      </v-container>
    </v-col>
  </v-row>
  <v-container class="button-strip put-symmetry">
    <div>
      <span class="text-title-medium no-select mr-2">Structure:</span>
      <span class="text-title-medium result-label" v-html="formula" />
      <span class="text-title-medium no-select mr-2 ml-4">Symmetry:</span>
      <span class="text-title-medium result-label">{{ spaceGroup || 'No symmetry' }}</span>
    </div>
    <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
  </v-container>
</v-container>
</v-app>
</template>

<style scoped>

.matches-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.matches-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
  display: flex;
  flex-direction: row;
  margin: 0;
  height: 100%;
  padding-top: 15px;
  max-width: 3000px !important;
  scrollbar-gutter: stable;
}

:deep(sub) {
  position: relative;
  bottom: -0.2rem;
}

.put-symmetry {
  justify-content: space-between;
}
</style>
