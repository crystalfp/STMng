<script setup lang="ts">
/**
 * @component
 * Controls for the enthalpy transition under pressure changes computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-23
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
import {onUnmounted, ref, watch} from "vue";
import {useControlStore} from "@/stores/controlStore";
import {storeToRefs} from "pinia";
import {askNode, receiveFromNode, sendToNode} from "@/services/RoutesClient";
import {resetNodeAlert, showNodeAlert} from "@/services/AlertMessage";

import BlockButton from "@/widgets/BlockButton.vue";
import NodeAlert from "@/widgets/NodeAlert.vue";

// > Properties
const {id, label} = defineProps<{

    /** Its own module id */
    id: string;

    /** Label on the node selector */
    label: string;
}>();

// Show this module has been loaded and access the control store
const controlStore = useControlStore();
controlStore.hasEnthalpyTransition = true;
const {enthalpyTransitionAccumulate} = storeToRefs(controlStore);

/** Result table entry */
interface TableEntry {
    /** Structure step */
    step: string;
    /** Corresponding formula */
    formula: string;
    /** Transition pressure */
    pressure: string;
}
const countAccumulated = ref(0);
const table = ref<TableEntry[]>([]);

/** Receive the parameters of the structures loaded */
receiveFromNode(id, "load", (params) => {

    if(params.error) {

        showNodeAlert(`Error from ${label}: ${params.error as string}`,
                      "enthalpyTransition");
        return;
    }

    countAccumulated.value = params.countAccumulated as number ?? 0;
    const rawSteps = params.steps as number[] ?? [];
    const rawFormulas = params.formulas as string[] ?? [];
    const rawPressures = params.pressures as number[] ?? [];

    table.value.length = 0;
    for(let i=0; i < rawSteps.length; ++i) {
        table.value.push({
            step: rawSteps[i].toFixed(0),
            formula: rawFormulas[i],
            pressure: rawPressures[i].toFixed(3)
        });
    }
});

/** Accumulation enabled in the reader */
const stopWatcher = watch(enthalpyTransitionAccumulate, () => {

    askNode(id, "capture", {
        enableAnalysis: controlStore.enthalpyTransitionAccumulate
    })
    .then((params) => {

        countAccumulated.value = params.countAccumulated as number ?? 0;
    })
    .catch((error: Error) => {
        showNodeAlert(`Error from toggle capture for ${label}: ${error.message}`,
                      "enthalpyTransition");
    });
});

// Cleanup
onUnmounted(() => {
    stopWatcher();
});

/**
 * Reset the accumulated structures
 */
const resetAccumulator = (): void => {

    sendToNode(id, "reset");
    countAccumulated.value = 0;
    resetNodeAlert();
    table.value.length = 0;
};

/**
 * Show the chart of the convex hull
 */
const saveStructures = (): void => {

    sendToNode(id, "save");
};

const alignEnd = "end" as "center" | "start" | "end";

/** Headers for the results table */
const headers = ref([
    {key: "step",     title: "Step",           align: alignEnd, width: 2},
    {key: "formula",  title: "Formula"},
    {key: "pressure", title: "Pressure (GPa)", align: alignEnd, width: 10, nowrap: true},
]);

</script>


<template>
<v-container class="container">
  <v-label class="separator-title first-title">Accumulated structures</v-label>

  <v-row class="mb-4">
    <v-col cols="7">
      <v-label class="result-label pt-1">{{ `Count: ${countAccumulated}` }}</v-label>
    </v-col>
    <v-col>
      <v-btn :disabled="countAccumulated===0" class="w-100" @click="resetAccumulator">Reset</v-btn>
    </v-col>
  </v-row>
  <v-data-table v-if="table.length > 0" :items="table"
                class="pr-2" density="compact" select-strategy="all" items-per-page="-1"
                fixed-header hover height="300px"
                hide-default-footer :headers hide-no-data>
    <template #item.formula="{item}">
      <div v-html="item.formula"/>
    </template>
  </v-data-table>
  <block-button class="mt-4 ml-1" label="Save transition structures"
                :disabled="table.length === 0" @click="saveStructures"/>
  <node-alert node="enthalpyTransition" class="mt-1"/>
</v-container>
</template>
