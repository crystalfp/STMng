<script setup lang="ts">
/**
 * @component
 * Mean displacement for trajectory visualizer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-04
 */
import {theme} from "@/services/ReceiveTheme";
import {ref, nextTick} from "vue";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import type {MeanDisplacement} from "@/types";

const means = ref<MeanDisplacement[]>([]);

receiveInWindow((data) => {

    void nextTick().then(() => {

        means.value.length = 0;
        const decodedData = JSON.parse(data) as MeanDisplacement[];
        for(const entry of decodedData) {
            means.value.push(entry);
        }
    });
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/displacements");

</script>


<template>
<v-app :theme>
  <v-container class="means-portal">
    <v-container class="means-container">
      <v-table class="pa-1 w-100 bg-transparent" density="default">
        <tr>
          <th colspan="2">Atom (index)</th>
          <th colspan="3">Mean position</th>
          <th class="pl-4">Mean displacement</th>
        </tr>
        <tr v-for="e of means" :key="e.index">
          <td class="w-2">{{ e.atomType }}</td>
          <td class="w-4">{{ `(${e.index}):` }}</td>
          <td class="w-1 right">{{ `[ ${e.meanX.toFixed(3)},` }}</td>
          <td class="w-2 right">{{ `${e.meanY.toFixed(3)},` }}</td>
          <td class="w-2 right">{{ `${e.meanZ.toFixed(3)} ]` }}</td>
          <td class="w-4 right pr-4">{{ e.displacement.toFixed(3) }}</td>
        </tr>
      </v-table>
    </v-container>
    <v-container class="button-strip">
      <v-btn v-focus @click="closeWindow('/displacements')">Close</v-btn>
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
