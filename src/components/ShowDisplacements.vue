<script setup lang="ts">
/**
 * @component
 * Mean displacement for trajectory visualizer.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-04
 */
import {theme} from "@/services/ReceiveTheme";
import {ref, nextTick, watch} from "vue";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import type {MeanDisplacement} from "@/types";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

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

const showMarkers = ref(false);
const showSizeMarkers = ref(1);
const sizeMarkers = ref(1);
watch([showMarkers, sizeMarkers], () => {
    sendToNode("SYSTEM", "show-markers", {
        visible: showMarkers.value,
        size: sizeMarkers.value
    });
});

</script>


<template>
<v-app :theme>
  <v-container class="means-portal">
    <v-container class="means-container">
      <v-table class="pa-1 w-100 bg-transparent" density="default">
        <tr>
          <th colspan="2">Atom (index)</th>
          <th class="pl-4" colspan="3">Mean position</th>
          <th class="pl-10">MSD</th>
        </tr>
        <tr v-for="e of means" :key="e.index">
          <td class="w-2">{{ e.atomType }}</td>
          <td class="w-4">{{ `(${e.index}):` }}</td>
          <td class="w-1 right">{{ `[ ${e.meanX.toFixed(3)},` }}</td>
          <td class="w-1 right">{{ `${e.meanY.toFixed(3)},` }}</td>
          <td class="w-1 right">{{ `${e.meanZ.toFixed(3)} ]` }}</td>
          <td class="w-4 right pr-4">{{ e.displacement.toFixed(4) }}</td>
        </tr>
      </v-table>
    </v-container>
    <v-container class="button-strip justify-space-between">
      <v-switch v-model="showMarkers" class="ml-2" label="Show markers"/>
      <slider-with-steppers v-model="sizeMarkers" v-model:raw="showSizeMarkers"
                      :disabled="!showMarkers"
                      label-width="7.6rem" :label="`Marker size (${showSizeMarkers})`"
                      :min="0.1" :max="4" :step="0.1" />
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
