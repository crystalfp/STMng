<script setup lang="ts">
/**
 * @component
 * Controls for the chart visualization
 */

import {ref, watchEffect} from "vue";
import {sb, type UiParams} from "@/services/Switchboard";

// > Properties
const props = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Get and set ui parameters from the switchboard
const chartType = ref("line");
const openChart = ref(false);
sb.getUiParams(props.id, (params: UiParams) => {
    chartType.value = params.chartType as string ?? "line";
});

watchEffect(() => {
    sb.setUiParams(props.id, {
        chartType: chartType.value,
        openChart: openChart.value
    });
});

</script>


<template>
<v-container class="container">
  <v-label class="ml-1 mb-3">Chart type</v-label><br>
  <v-btn-toggle v-model="chartType" color="primary" class="mb-6">
    <v-btn value="line">Line</v-btn>
    <v-btn value="bar">Bar</v-btn>
  </v-btn-toggle>
  <v-btn block @click="openChart=true">Open chart</v-btn>
</v-container>
</template>
