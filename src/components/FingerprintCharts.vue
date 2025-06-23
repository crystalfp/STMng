<script setup lang="ts">
/**
 * @component
 * Show the charts resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-20
 */
import {computed, ref, shallowRef, watch} from "vue";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import {Scatter} from "vue-chartjs";
import {Chart as ChartJS, Title, Tooltip, Legend, CategoryScale,
        LinearScale, PointElement, LineElement} from "chart.js";
import type {ChartData, ChartOptions, FingerprintsChartData, FingerprintsChartKind} from "@/types";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

/** Setup chart component */
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend);

/** The chart type */
const chartType = ref<FingerprintsChartKind>("fp");

/** The chart parameters */
const fpIndex = ref(0);
const showFpIndex = ref(0);
const countFingerprints = ref(0);
const ids = ref<number[]>([]);
const binCount = ref(50);
const showBinCount = ref(50);

/** Enable buttons */
const haveEnergies = ref(false);
const haveDistances = ref(false);

/** Data and options for the chart component (will be filled when receiving data) */
const chartOptions = shallowRef<ChartOptions>({
    responsive: true,
    maintainAspectRatio: false,
});
const chartData = shallowRef<ChartData>({
    datasets: []
});

/**
 * Build data for the chart
 *
 * @param label - Dataset label
 * @param data - The data as an array of xy pairs
 * @param showLine - If the line should be visible
 * @param pointRadius - Radius of the points
 */
const buildChartData = (label: string,
                        data: {x: number; y: number}[],
                        showLine: boolean,
                        pointRadius: number): ChartData => ({
    datasets: [{
        label,
        data,
        borderColor: "#00ff00",
        backgroundColor: "#00ff00",
        showLine,
        pointRadius
     }]
});

/**
 * Build the layout data for the chart
 *
 * @param labelX - Label for X axis
 * @param labelY - Label for Y axis
 */
const buildChartOptions = (labelX: string, labelY: string): ChartOptions => ({

    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
    },
    elements: {line: {borderWidth: 2}},
    layout: {padding: 20},
    scales: {
        x: {
            title: {
                color: "red",
                display: true,
                text: labelX,
                font: {
                    size: 20,
                },
            },
            grid: {
                color: "#575757"
            }
        },
        y: {
            title: {
                color: "red",
                display: true,
                text: labelY,
                font: {
                    size: 20,
                },
            },
            grid: {
                color: "#575757"
            }
        }
    }
});

/**
 * Prepare the coordinates for visualizing an histogram
 *
 * @param histogram - Histogram data: one entry per bin as x has the bin value and y the count
 */
const prepareHistogramCoordinates = (histogram: [x: number, y: number][]): {x: number; y: number}[] => {

    const lineCoordinates: {x: number; y: number}[] = [];

    let previousY = 0;
    for(const entry of histogram) {
        lineCoordinates.push({x: entry[0], y: previousY},
                             {x: entry[0], y: entry[1]});
        previousY = entry[1];
    }
    const lastX = histogram.at(-1)![0];
    const width = lastX - histogram.at(-2)![0];
    lineCoordinates.push({x: lastX+width, y: previousY},
                         {x: lastX+width, y: 0});

    return lineCoordinates;
};

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    /** The received data */
    const fingerprintChartData = JSON.parse(dataFromMain) as FingerprintsChartData;
    const {fingerprint, energy, energyDistance, energyHistogram, order, distances,
           distanceHistogram, haveEnergies: haveE, haveDistances: haveD} = fingerprintChartData;

    // Disable buttons if no energy or distances provided
    haveEnergies.value = haveE;
    haveDistances.value = haveD;

    // If received fingerprint data
    if(fingerprint) {

        const {countFingerprints: count, structureIds} = fingerprintChartData;

        // Sanity check
        if(!count || !structureIds || structureIds.length === 0) return;

        countFingerprints.value = count;

        ids.value.length = 0;
        for(const id of structureIds) ids.value.push(id);

        const lineCoordinates: {x: number; y: number}[] = [];
        let previousY = fingerprint[0][1];
        lineCoordinates.push({x: 0, y: fingerprint[0][1]});
        for(let i=1; i < fingerprint.length; ++i) {
            lineCoordinates.push({x: fingerprint[i][0], y: previousY},
                                 {x: fingerprint[i][0], y: fingerprint[i][1]});
            previousY = fingerprint[i][1];
        }

        chartData.value = buildChartData("Fingerprint", lineCoordinates, true, 0);

        chartOptions.value = buildChartOptions("Distance", "Fingerprint value");
    }
    else if(energy) {
        const lineCoordinates = energy.map((value) => ({x: value[0], y: value[1]}));

        chartData.value = buildChartData("Energy", lineCoordinates, false, 4);

        chartOptions.value = buildChartOptions("Structure step",
                                               "Energy");
    }
    else if(energyDistance) {

        const lineCoordinates: {x: number; y: number}[] = [];
        for(const pair of energyDistance) {
            lineCoordinates.push({x: pair[0], y: pair[1]});
        }

        chartData.value = buildChartData("Energy delta", lineCoordinates, false, 4);

        chartOptions.value = buildChartOptions("Distance from energy minimum",
                                               "Energy difference from minimum");
    }
    else if(energyHistogram) {

        const lineCoordinates = prepareHistogramCoordinates(energyHistogram);

        chartData.value = buildChartData("Energy histogram", lineCoordinates, true, 0);

        chartOptions.value = buildChartOptions("Energy", "Count");
    }
    else if(distanceHistogram) {

        const lineCoordinates = prepareHistogramCoordinates(distanceHistogram);

        chartData.value = buildChartData("Distance histogram", lineCoordinates, true, 0);

        chartOptions.value = buildChartOptions("Distance", "Count");
    }
    else if(order) {

        const lineCoordinates = order.map((value) => ({x: value[0], y: value[1]}));

        chartData.value = buildChartData("Order parameter", lineCoordinates, false, 4);

        chartOptions.value = buildChartOptions("Structure step",
                                               "Order parameter");
    }
    else if(distances) {

        const lineCoordinates = distances.map((value) => ({x: value[0], y: value[1]}));

        chartData.value = buildChartData("distance", lineCoordinates, false, 4);

        chartOptions.value = buildChartOptions("Structure step",
                                               "Distance from given fingerprint");
    }
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/fp-charts");

/** Send user choices to the main process */
watch([fpIndex, chartType, binCount], () => {

    sendToNode("SYSTEM", "chart-request", {
        fpIndex: fpIndex.value,
        binCount: binCount.value,
        chartType: chartType.value
    });
});

/** Helpers to show sliders */
const showStepSlider = computed(() => ["fp", "di"].includes(chartType.value));
const showBinCountSlider = computed(() => ["eh", "dh"].includes(chartType.value));

</script>


<template>
<v-app :theme>
  <div class="fp-chart-portal">
    <div class="fp-chart-viewer">
      <Scatter :options="chartOptions" :data="chartData" />
    </div>
    <v-container class="fp-chart-buttons">
      <div class="buttons-line1">
        <slider-with-steppers v-show="showStepSlider" v-model="fpIndex"
                                v-model:raw="showFpIndex" label-width="11rem"
                                :label="`Structure step ${ids[showFpIndex] ?? '(none)'}`"
                                :min="0" :max="countFingerprints-1" :step="1" />
        <slider-with-steppers v-show="showBinCountSlider" v-model="binCount"
                                v-model:raw="showBinCount" label-width="11rem"
                                :label="`Bin count (${showBinCount})`"
                                :min="2" :max="200" :step="1" />
    </div>
      <div class="buttons-line">
        <v-btn-toggle v-model="chartType" mandatory>
          <v-btn value="fp">Fingerprint</v-btn>
          <v-btn value="en" :disabled="!haveEnergies">Energy</v-btn>
          <v-btn value="ed" :disabled="!haveEnergies || !haveDistances">Energy-Dist</v-btn>
          <v-btn value="eh" :disabled="!haveEnergies">Hist energies</v-btn>
          <v-btn value="dh" :disabled="!haveDistances">Hist distances</v-btn>
          <v-btn value="op">Order param</v-btn>
          <v-btn value="di" :disabled="!haveDistances">Distances</v-btn>
        </v-btn-toggle>
        <v-btn v-focus @click="closeWindow('/fp-charts')">Close</v-btn>
      </div>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

.fp-chart-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.fp-chart-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 20px;
}

.fp-chart-buttons {
  flex-direction: column;
  display: flex;
  max-width: 3000px !important;
  padding: 20px 20px 16px 20px !important;
}

.buttons-line {
  justify-content: space-between;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  padding-right: 40px !important;
  padding-left: 0;
}

.buttons-line1 {
  max-width: 3000px !important;
  width: 100vw;
  padding-right: 25px;
  padding-left: 0;
  margin: -44px 0 28px -5px;
}

</style>
