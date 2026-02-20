<script setup lang="ts">
/**
 * @component
 * Mean displacement for trajectory visualizer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-04
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
import {theme} from "@/services/ReceiveTheme";
import {ref, reactive, nextTick} from "vue";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import type {AveragesResult} from "@/electron/modules/ReorderAtomsInSteps";
import type {CtrlParams} from "@/types";

const means = reactive<AveragesResult[]>([]);

const coordinates = ref("(cartesian)");
const windowPath = "/displacements";

requestData(windowPath, (params: CtrlParams) => void nextTick().then(() => {

    means.length = 0;
    coordinates.value = "(cartesian)";
    const decodedData = JSON.parse(params.means as string) as AveragesResult[];
    if(decodedData.length > 0) {

        for(const entry of decodedData) means.push(entry);

        if(decodedData[0].isFractional) coordinates.value = "(fractional)";
    }
}));

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/** Number of digits before changing to exponential notation */
const FORMAT_MAX_DIGITS = 4;
const FORMAT_LIMIT = 10**(-FORMAT_MAX_DIGITS);

/**
 * Format a number as fixed or exponential format if it is too small
 *
 * @param value - Number to be formatted
 */
const format = (value: number): string => {

    if(value < -FORMAT_LIMIT || value > FORMAT_LIMIT || value === 0) {
        return value.toFixed(FORMAT_MAX_DIGITS);
    }
    return value.toExponential(FORMAT_MAX_DIGITS-2);
};

</script>


<template>
<v-app :theme>
  <v-container class="means-portal">
    <v-container class="means-container">
      <v-table class="pa-1 w-100 bg-transparent" density="default">
        <tr>
          <th colspan="2">Atom (index)</th>
          <th class="pl-4" colspan="3">Mean position {{ coordinates }}</th>
          <th class="pl-10">MSD</th>
        </tr>
        <tr v-for="e of means" :key="e.index">
          <td class="w-2">{{ e.atomType }}</td>
          <td class="w-4">{{ `(${e.index}):` }}</td>
          <td class="w-1 right">{{ `[ ${e.position[0].toFixed(3)},` }}</td>
          <td class="w-1 right">{{ `${e.position[1].toFixed(3)},` }}</td>
          <td class="w-1 right">{{ `${e.position[2].toFixed(3)} ]` }}</td>
          <td class="w-4 right pr-4">{{ format(e.displacement) }}</td>
        </tr>
      </v-table>
    </v-container>
    <v-container class="button-strip justify-end">
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </v-container>
</v-app>
</template>


<style scoped>

.means-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.means-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
  display: flex;
  flex-direction: row;
  margin: 0;
  height: 100%;
  max-width: 3000px !important;
  scrollbar-gutter: stable;
}

th {
  text-align: left;
  color: light-dark(#7ca911, #baf434) !important;
}

.right {
  text-align: right
}

.w-1 {
  width: 1rem
}

.w-2 {
  width: 2rem
}

.w-4 {
  width: 4rem
}
</style>
