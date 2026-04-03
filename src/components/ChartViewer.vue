<script setup lang="ts">
/**
 * @component
 * Show the X-Ray diffraction chart in a secondary window.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-05
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
import {computed, ref} from "vue";
import {VisXYContainer, VisLine, VisAxis, VisScatter} from "@unovis/vue";
import {closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";
import type {CtrlParams} from "@/types";

const windowPath = "/chart";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    x: number;
    /** Y value */
    y: number;
    /** Optional label */
    label?: string;
}

const points = ref<DataRecord[]>([]);
const scatter = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const showLabels = ref(false);
const lineSmooth = ref(true);
const range = ref([0, 90]);
const showGrid = ref(true);

// Accessors for the charts
const xp = (d: DataRecord): number => d.x;
const yp = (d: DataRecord): number => d.y;
const lp = (d: DataRecord): string => d.label!;

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    const labelX = params.labelX as number[] ?? [];
    const labelY = params.labelY as number[] ?? [];
    const labelText = params.labelText as string[] ?? [];
    const lineX = params.lineX as number[] ?? [];
    const lineY = params.lineY as number[] ?? [];
    lineSmooth.value = params.lineSmooth as boolean ?? true;
    const rangeRaw = params.range as number[] ?? [0, 90];
    range.value[0] = rangeRaw[0];
    range.value[1] = rangeRaw[1];

    points.value.length = 0;
    let len = lineX.length;
    for(let i=0; i < len; ++i) {
        points.value.push({x: lineX[i], y: lineY[i]});
    }
    scatter.value.length = 0;
    showLabels.value = params.labelShow as boolean ?? false;
    if(showLabels.value) {
        len = labelX.length;
        for(let i=0; i < len; ++i) {
            scatter.value.push({
                x: labelX[i],
                y: labelY[i],
                label: labelText[i]
            });
        }
    }

    forceUpdate.value = !forceUpdate.value;
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Make a chart snapshot
 */
const makeImage = (): void => {

    sendToNode("SYSTEM", "save-snapshot", {
        routerPath: windowPath,
        title: "Save X-Ray diffraction chart snapshot",
        margin: 60
    });
};

/**
 * Save the chart point to a file
 */
const savePoints = (): void => {

    sendToNode("SYSTEM", "save-xrd");
};

/**
 * Save the spectra peaks to a file
 */
const savePeaks = (): void => {

    sendToNode("SYSTEM", "save-peaks");
};

const curveType = computed(() => (lineSmooth.value ? "basis" : "step"));

// Below there are settings (like labelColor) that seems redundant,
// but they make the screenshot works
</script>


<template>
<v-app :theme>
  <div class="chart-portal">
    <VisXYContainer :margin="{right: 20, top: 30, left: 20, bottom: 10}"
                    :xDomain="range" :yDomain="[0, 100]" :duration="0"
                    :scaleByDomain="true" class="chart-container">
      <VisLine :key="forceUpdate" :data="points" :x="xp" :y="yp" :curveType/>
      <VisScatter v-if="showLabels" :data="scatter" :x="xp" :y="yp"
                  color="red" :size="4"
                  :label="lp" labelColor="red" labelPosition="right" />
      <VisAxis type="x" label="2θ (degrees)" :gridLine="showGrid"
               labelColor="#6C778C" :labelFontSize="24" numTicks="10"
               tickTextColor="#6C778C"/>
      <VisAxis type="y" label="Intensity (a. u.)" :gridLine="showGrid"
               labelColor="#6C778C" :labelFontSize="24"
               tickTextColor="#6C778C"/>
    </VisXYContainer>
    <v-container class="button-strip">
      <v-switch v-model="showGrid" label="Show grid"/>
      <v-btn @click="savePeaks">Save peaks</v-btn>
      <v-btn @click="savePoints">Save points</v-btn>
      <v-btn @click="makeImage">Save image</v-btn>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

.chart-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chart-container {
  overflow-y: auto;
  width: 100vw;
  flex: 2;
  padding: 0;
  --vis-axis-tick-color: #6C778C;
  --vis-axis-grid-color: #6C778C;
  --vis-axis-grid-line-dasharray: 1 3
}

</style>
