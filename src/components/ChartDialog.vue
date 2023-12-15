<script setup lang="ts">
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import type {ChartData} from "@/types";

// import {ref} from "vue";


receiveInWindow((data) => {

    const decodedData = JSON.parse(data) as ChartData;

    console.log(decodedData.x, decodedData.y);
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
    Here goes the chart
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

@use "@/styles/colors";
@use "@/styles/fonts";

.chart-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chart-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
}

.chart-button-strip {
  display: flex;
  justify-content: flex-end;
  align-items: center;

  button {
    margin: 0 5px 5px 0;
    width: 6rem;
    font-size: 1.1rem;
  }
}

</style>
