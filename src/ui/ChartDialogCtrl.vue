<script setup lang="ts">
/**
 * @component
 * Controls for the chart visualization
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";
import {createWindow, sendToWindow} from "@/services/RoutesClient";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Get and set ui parameters from the switchboard
const chartType = ref("line");
sb.getUiParams(props.id, (params: UiParams) => {
    chartType.value = params.chartType as string ?? "line";
});

watchEffect(() => {
    sb.setUiParams(props.id, {chartType: chartType.value});
});

// TEST Hardcoded chart data
const chartTitle = "Test chart";

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
          text: chartTitle,
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

// > Open the chart window
const openChart = (): void => {

    const dataToSend = JSON.stringify({
        data: chartData,
        options: chartOptions,
        type: chartType.value
    });

    createWindow({
                    routerPath: "/chart",
                    width: 800,
                    height: 600,
                    title: chartTitle,
                    data: dataToSend
                });
};

// > Accept changes from the ui
watchEffect(() => {

    const dataToSend = JSON.stringify({
        data: chartData,
        options: chartOptions,
        type: chartType.value
    });
    sendToWindow("/chart", dataToSend);
});

</script>


<template>
<v-container class="container">
  <v-radio-group v-model="chartType" inline label="Chart type">
    <v-radio label="Line" value="line" />
    <v-radio label="Bar" value="bar" />
  </v-radio-group>
  <v-btn @click="openChart">Open chart</v-btn>
</v-container>
</template>
