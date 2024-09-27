<script setup lang="ts">
/**
 * @component
 * Show a chart in a secondary window.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-05
 */
import {ref} from "vue";
import {Bar, Line} from "vue-chartjs";
import {Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale,
        LinearScale, PointElement, LineElement} from "chart.js";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {closeWithEscape} from "@/services/CaptureEscape";
import {theme} from "@/services/ReceiveTheme";
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

/** Close the window on Esc press */
closeWithEscape("/chart");

</script>


<template>
<v-app :theme="theme">
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
      </v-btn>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

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
