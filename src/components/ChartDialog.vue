<script setup lang="ts">
import {ref} from "vue";
import {Bar, Line} from "vue-chartjs";
import {Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale,
        LinearScale, PointElement, LineElement} from "chart.js";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import type {ChartParams} from "@/types";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend);

const chartType = ref<string>("");
let decodedData: ChartParams;
receiveInWindow((data) => {

    decodedData = JSON.parse(data) as ChartParams;
    chartType.value = decodedData.type;
});

const captureEscape = (event: KeyboardEvent): void => {
    if(event.key === "Escape") {
        closeWindow("/chart");
        event.preventDefault();
        document.removeEventListener("keydown", captureEscape);
    }
};
document.addEventListener("keydown", captureEscape);

</script>


<template>
<div class="chart-portal">
  <div class="chart-container">
    <Bar v-if="chartType === 'bar'"
      :options="decodedData.options"
      :data="decodedData.data"
    />
    <Line v-else-if="chartType === 'line'"
      :options="decodedData.options"
      :data="decodedData.data"
    />
  </div>
  <v-container class="chart-button-strip">
    <v-btn @click="closeWindow('/chart')">
      Close
      <v-tooltip activator="parent" location="top">Close chart</v-tooltip>
    </v-btn>
  </v-container>
</div>
</template>


<style scoped lang="scss">

.chart-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chart-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
  padding: 10px;
}

.chart-button-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  max-width: 2000px;
}

</style>
