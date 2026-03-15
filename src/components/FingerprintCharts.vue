<script setup lang="ts">
/**
 * @component
 * Show the charts resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-20
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {computed, ref, reactive, watch, onUnmounted} from "vue";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import type {CtrlParams, FingerprintsChartData,
             FingerprintsChartKind} from "@/types";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

import {Scatter} from "@unovis/ts";
import {VisXYContainer, VisScatter, VisAxis, VisLine, VisPlotline, VisTooltip} from "@unovis/vue";

/** The chart type */
const chartType = ref<FingerprintsChartKind>("fp");

/** The chart parameters */
const fpIndex = ref(0);
const showFpIndex = ref(0);
const countFingerprints = ref(0);
const ids = reactive<number[]>([]);
const binCount = ref(50);
const showBinCount = ref(50);

/** Enable buttons */
const haveEnergies = ref(false);
const haveDistances = ref(false);

const windowPath = "/fp-charts";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    x: number;
    /** Y value */
    y: number;
}

const points = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const titleX = ref("");
const titleY = ref("");
const showLine = ref(true);
const showPoints = ref(false);
const showZero = ref(false);

// Accessors for the charts
const xp = (d: DataRecord): number => d.x;
const yp = (d: DataRecord): number => d.y;
const triggers = {

    [Scatter.selectors.point]: (d: DataRecord) => {

        const x = titleX.value.includes("step") ? d.x.toFixed(0) : d.x.toFixed(3);
        return `
        <table>
        <tr><td>${titleX.value}:</td><td>${x}</td></tr>
        <tr><td>${titleY.value}:</td><td>${d.y.toFixed(3)}</td></tr>
        </table>
        `;
    }
};

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    /** The received data */
    const fingerprintChartData = JSON.parse(params.charts as string) as FingerprintsChartData;
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

        ids.length = 0;
        for(const id of structureIds) ids.push(id);

        points.value.length = 0;
        for(const fp of fingerprint) {
            points.value.push({x: fp[0], y: fp[1]});
        }

        titleX.value = "Distance";
        titleY.value = "Fingerprint value";
        showLine.value = true;
        showPoints.value = false;
        showZero.value = true;
    }
    else if(energy) {

        points.value.length = 0;
        for(const pt of energy) {
            points.value.push({x: pt[0], y: pt[1]});
        }

        titleX.value = "Structure step";
        titleY.value = "Energy per atom";
        showLine.value = false;
        showPoints.value = true;
        showZero.value = false;
    }
    else if(energyDistance) {

        points.value.length = 0;
        for(const pair of energyDistance) {
            points.value.push({x: pair[0], y: pair[1]});
        }
        titleX.value = "Distance from energy minimum";
        titleY.value = "Energy difference from minimum";
        showLine.value = false;
        showPoints.value = true;
        showZero.value = false;
    }
    else if(energyHistogram) {

        points.value.length = 0;
        for(const pt of energyHistogram) {
            points.value.push({x: pt[0], y: pt[1]});
        }

        titleX.value = "Energy per atom";
        titleY.value = "Count";
        showLine.value = true;
        showPoints.value = false;
        showZero.value = false;
    }
    else if(distanceHistogram) {

        points.value.length = 0;
        for(const pt of distanceHistogram) {
            points.value.push({x: pt[0], y: pt[1]});
        }

        titleX.value = "Distance";
        titleY.value = "Count";
        showLine.value = true;
        showPoints.value = false;
        showZero.value = false;
    }
    else if(order) {

        points.value.length = 0;
        for(const pair of order) {
            points.value.push({x: pair[0], y: pair[1]});
        }

        titleX.value = "Structure step";
        titleY.value = "Order parameter";
        showLine.value = false;
        showPoints.value = true;
        showZero.value = false;
    }
    else if(distances) {

        points.value.length = 0;
        for(const pair of distances) {
            points.value.push({x: pair[0], y: pair[1]});
        }

        titleX.value = "Structure step";
        titleY.value = "Fingerprint distance from selected step";
        showLine.value = false;
        showPoints.value = true;
        showZero.value = false;
    }
    forceUpdate.value = !forceUpdate.value;
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/** Send user choices to the main process */
const stopWatcher = watch([fpIndex, chartType, binCount], () => {

    sendToNode("SYSTEM", "chart-request", {
        fpIndex: fpIndex.value,
        binCount: binCount.value,
        chartType: chartType.value
    });
});

// Cleanup
onUnmounted(() => stopWatcher());

/** Helpers to show sliders */
const showStepSlider = computed(() => ["fp", "di"].includes(chartType.value));
const showBinCountSlider = computed(() => ["eh", "dh"].includes(chartType.value));

</script>


<template>
<v-app :theme>
  <div class="fp-chart-portal">
    <VisXYContainer :margin="{right: 40, top: 20, left: 10, bottom: 50}" class="fp-chart-viewer">
      <VisLine v-if="showLine" :key="forceUpdate" :data="points" :x="xp" :y="yp" curveType="step"/>
      <VisScatter v-if="showPoints" :key="forceUpdate" :data="points" :x="xp" :y="yp"
                  :size="8" shape="square"/>
      <VisPlotline v-if="showZero" lineStyle="dot" :value="0" />
      <VisAxis type="x" :gridLine="false" :label="titleX" :fullSize="true"
              :labelFontSize="24"/>
      <VisAxis type="y" :gridLine="false" :label="titleY"
              :fullSize="true" :labelFontSize="24" />
      <VisTooltip :triggers :followCursor="false" verticalPlacement="bottom" />
    </VisXYContainer>
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
        <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
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
