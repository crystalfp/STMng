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
  <v-label class="ml-1 mb-3">Chart type</v-label>
  <v-radio-group v-model="chartType" inline>
    <v-radio label="Line" value="line" />
    <v-radio label="Bar" value="bar" />
  </v-radio-group>
  <v-btn block @click="openChart=true">Open chart</v-btn>
</v-container>
</template>
