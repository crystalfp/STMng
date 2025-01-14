<script setup lang="ts">
/**
 * @component
 * Show the energy surface resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-14
 */
import {onMounted, ref} from "vue";
import {theme} from "@/services/ReceiveTheme";
import type {EnergyLandscapeData} from "@/types";
import {closeWithEscape} from "@/services/CaptureEscape";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";

/** The canvas sizes (will be computed during mount or resize) */
const canvasWidth = ref(500);
const canvasHeight = ref(300);

/** The received data */
let energyLandscapeData: EnergyLandscapeData | undefined;
const energyLandscapeDataAvailable = ref(false);


onMounted(() => {

    // Get the canvas size
    const canvas = document.querySelector<HTMLDivElement>(".landscape-viewer");
    if(!canvas) return;

    canvasWidth.value  = canvas.clientWidth;
    canvasHeight.value = canvas.clientHeight;

    // Adjust the canvas size on window resize
    let timer: NodeJS.Timeout;
    globalThis.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            canvasWidth.value  = canvas.clientWidth;
            canvasHeight.value = canvas.clientHeight;
        }, 200);
    });
});

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    energyLandscapeData = JSON.parse(dataFromMain) as EnergyLandscapeData;
    energyLandscapeDataAvailable.value = true;
    void energyLandscapeData; // TBD
});

/** Close the window on Esc press */
closeWithEscape("/landscape");

</script>


<template>
<v-app :theme="theme">
  <div class="landscape-portal">
    <div class="landscape-viewer">
    </div>
    <v-container class="landscape-buttons">
      <div class="buttons-line">
        <v-btn v-focus @click="closeWindow('/landscape')" class="mr-2 mb-4">Close</v-btn>
      </div>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

.landscape-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.landscape-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}

.landscape-buttons {
  flex-direction: column;
  display: flex;
  max-width: 3000px !important;
  padding: 0 20px 16px 20px !important;
}

.buttons-line {
  justify-content: space-between;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  padding-right: 40px !important;
}

</style>
