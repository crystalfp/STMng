<script setup lang="ts">
/**
 * @component
 * Show the charts resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-20
 */
import {ref, shallowRef, watch} from "vue";
import {closeWithEscape} from "@/services/CaptureEscape";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import {Scatter} from "vue-chartjs";
import {Chart as ChartJS, Title, Tooltip, Legend, CategoryScale,
        LinearScale, PointElement, LineElement} from "chart.js";
import type {ChartData, ChartOptions, FingerprintsChartData} from "@/types";

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
const chartType = ref("fp");

/** The chart parameters */
const fpIndex = ref(0);
const showFpIndex = ref(0);
const countFingerprints = ref(0);
const ids = ref<number[]>([]);
const haveEnergies = ref(true);

/** Data and options for the chart component (will be filled when receiving data) */
const chartOptions = shallowRef<ChartOptions>({
    responsive: true,
    maintainAspectRatio: false,
});
const chartData = shallowRef<ChartData>({
    datasets: []
});

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    /** The received data */
    const fingerprintChartData = JSON.parse(dataFromMain) as FingerprintsChartData;
    const lineCoordinates: {x: number; y: number}[] = [];
    const {fingerprint, energyDistance, haveEnergies: haveE} = fingerprintChartData;

    // Disable buttons if no energy provided
    haveEnergies.value = haveE;

    // If received fingerprint data
    if(fingerprint) {

        const {countFingerprints: count, structureIds} = fingerprintChartData;

        // Sanity check
        if(!count || !structureIds || structureIds.length === 0) return;

        countFingerprints.value = count;

        ids.value.length = 0;
        for(const id of structureIds) ids.value.push(id);

        lineCoordinates.length = 0;
        let previousY = fingerprint[0];
        lineCoordinates.push({x: 0, y: fingerprint[0]});
        for(let i=1; i < fingerprint.length; ++i) {
            lineCoordinates.push({x: i, y: previousY},
                                 {x: i, y: fingerprint[i]});
            previousY = fingerprint[i];
        }

        chartData.value = {
            datasets: [
                {
                    label: "Fingerprint",
                    data: lineCoordinates,
                    borderColor: "#00ff00",
                    backgroundColor: "#00ff00",
                    showLine: true,
                    pointRadius: 0,
                }
            ]
        };

        chartOptions.value = {
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
						text: "index",
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
						text: "fingerprint value",
						font: {
							size: 20,
						},
					},
					grid: {
						color: "#575757"
					}
				}
			}
		};
    }
    else if(energyDistance) {

        lineCoordinates.length = 0;
        for(const pair of energyDistance) {
            lineCoordinates.push({x: pair[0], y: pair[1]});
        }

        chartData.value = {
            datasets: [
                {
                    label: "Energy delta",
                    data: lineCoordinates,
                    borderColor: "#00ff00",
                    backgroundColor: "#00ff00",
                    showLine: true,
                    pointRadius: 0,
                }
            ]
        };

        chartOptions.value = {
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
						text: "distance from energy minimum",
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
						text: "energy difference from minimum",
						font: {
							size: 20,
						},
					},
					grid: {
						color: "#575757"
					}
				}
			}
		};
    }
});

/** Close the window on Esc press */
closeWithEscape("/fp-charts");

/** Send user choices to the main process */
watch([fpIndex, chartType], () => {

    sendToNode("SYSTEM", "chart-request", {
        fpIndex: fpIndex.value,
        chartType: chartType.value
    });
});

</script>


<template>
<v-app :theme="theme">
  <div class="fp-chart-portal">
    <div class="fp-chart-viewer">
      <Scatter
        :options="chartOptions"
        :data="chartData"
      />
    </div>
    <v-container class="fp-chart-buttons">
      <div class="buttons-line">
        <v-btn-toggle v-model="chartType" mandatory>
          <v-btn value="fp">Fingerprint</v-btn>
          <v-btn value="ed" :disabled="!haveEnergies">Energy-Dist</v-btn>
        </v-btn-toggle>
        <g-slider-with-steppers v-if="chartType==='fp'" v-model="fpIndex"
                                v-model:raw="showFpIndex" label-width="11rem"
                                :label="`Structure step ${ids[showFpIndex]}`"
                                :min="0" :max="countFingerprints" :step="1" />
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

</style>
