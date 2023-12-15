<script setup lang="ts">
import {ref, watchEffect} from "vue";

import {createWindow, sendToWindow} from "@/services/RoutesClient";

const chartType = ref("line");

const openChart = (): void => {

    const dataToSend = JSON.stringify({
                x: [1, 2, 3],
                y: [12, 7.5, 9],
                type: chartType.value
            });

    createWindow({
                    routerPath: "/chart",
                    width: 800,
                    height: 600,
                    title: "Chart example",
                    data: dataToSend
                });
};

watchEffect(() => {
    sendToWindow("/chart", JSON.stringify({type: chartType.value}));
});

</script>


<template>
<v-container class="container">
  <v-radio-group v-model="chartType" inline label="Chart type">
    <v-radio label="Line" value="line" />
    <v-radio label="Bar" value="bar" />
  </v-radio-group>
  <v-btn @click="openChart">Open Chart</v-btn>
</v-container>
</template>
