<script setup lang="ts">
/**
 * @component
 * Controls for the chart visualization
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watch} from "vue";
import {askNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

const chartType = ref("line");
const openChart = ref(false);

askNode(id, "init")
    .then((params) => {
        chartType.value = params.chartType as string ?? "line";
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for ChartViewer: ${error.message}`));


watch([chartType, openChart], () => {
    askNode(id, "show", {
        chartType: chartType.value,
        openChart: openChart.value
    })
    .then((params) => {
        chartType.value = params.chartType as string ?? "line";
        openChart.value = params.openChart as boolean ?? false;
    })
    .catch((error: Error) => showAlertMessage(`Error from show chart for ChartViewer: ${error.message}`));
});

</script>


<template>
<v-container class="container">
  <v-row class="mt-4 mb-1">
    <v-label class="ml-4 mb-3 mr-4 pb-3 no-select">Chart type:</v-label>
    <v-btn-toggle v-model="chartType" color="primary" mandatory class="mb-6">
      <v-btn value="line">Line</v-btn>
      <v-btn value="bar">Bar</v-btn>
    </v-btn-toggle>
  </v-row>
  <v-btn block @click="openChart=true">Open chart</v-btn>
</v-container>
</template>
