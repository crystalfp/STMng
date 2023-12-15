<script setup lang="ts">
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import type {ChartData} from "@/types";
import {Bar, Line} from "vue-chartjs";
import {ref} from "vue";
import {Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement,
        LineElement} from "chart.js";

const chartType = ref<string>("line");

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend);

const chartData = {
    labels: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ],
    datasets: [
        {
            label: "Data One",
            backgroundColor: "#f87979",
            data: [40, 20, 12, 39, 10, 40, 39, 80, 40, 20, 12, 11],
            borderColor: "#f87979",
        },
        {
            label: "Data Two",
            backgroundColor: "#00ff00",
            data: [4, 2, 2, 4, 1, 4, 5, 9, 6, 19, 3, 8],
            borderColor: "#00ff00",
        }
    ]
};
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
          text: "Test chart",
          display: true,
          font: {
              size: 30
          }
      }
    },
    scales: {
      x: {
        title: {
          color: "red",
          display: true,
          text: "Month"
        },
        grid: {
          color: "aqua"
        }
      },
      y: {
        title: {
          color: "green",
          display: true,
          text: "Sales"
        },
        grid: {
          color: "aqua"
        }
      }
    }
};

receiveInWindow((data) => {

    const decodedData = JSON.parse(data) as ChartData;

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
      :options="chartOptions"
      :data="chartData"
    />
    <Line v-if="chartType === 'line'"
      :options="chartOptions"
      :data="chartData"
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
