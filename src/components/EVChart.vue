<script setup lang="ts">
/**
 * @component
 * Display Energy-volume chart for variable composition with one component.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-09
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {computed, onUnmounted, ref, watch} from "vue";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {Scatter} from "@unovis/ts";
import {VisXYContainer, VisScatter, VisAxis, VisTooltip,
        VisLine} from "@unovis/vue";
import {Lut} from "three/addons/math/Lut.js";
import type {CtrlParams} from "@/types";

import SelectColormap from "@/widgets/SelectColormap.vue";
import ViewerLegend from "@/widgets/ViewerLegend.vue";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    x: number | undefined;
    /** Y value */
    y: number | undefined;
    /** Corresponding step in the loaded sequence */
    step?: number;
    /** Chemical formula */
    formula?: string;
    /** Energy difference from the convex hull */
    delta?: number;
    /** Index of the point on the convex hull */
    idx?: number;
    /** Point color */
    color?: string;
}

const points = ref<DataRecord[]>([]);
const line = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const pointColoring = ref("none");
const showLegend = ref(false);
const colormapName = ref("rainbow");
const lutMin = ref(0);
const lutMax = ref(1);

const windowPath = "/ev-chart";

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Create colormap for the point values
 *
 * @param kind - Coloring method
 * @param colormap - Name of the colormap to use
 * @param distance - Point distance from the convex hull
 */
const createColors = (kind: string, colormap: string,
                      distance: number[]): string[] => {

    if(kind === "none") return Array<string>(distance.length).fill("#C45C10");

    let maxValue = Number.NEGATIVE_INFINITY;
    let minValue = Number.POSITIVE_INFINITY;
    for(const value of distance) {
        if(value > maxValue) maxValue = value;
        if(value < minValue) minValue = value;
    }

    const lut = new Lut(colormap, 128);
    lut.setMax(maxValue);
    lut.setMin(minValue);
    lutMin.value = minValue;
    lutMax.value = maxValue;

    return distance.map((value) => `#${lut.getColor(value).getHexString()}`);
};

let delta: number[];

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    const energy  = params.energy as number[] ?? [];
    const volume  = params.volume as number[] ?? [];
    const step    = params.step as number[] ?? [];
    const formula = params.formula as string[] ?? [];
    delta         = params.delta as number[] ?? [];
    const lineX   = params.lineX as number[] ?? [];
    const lineY   = params.lineY as number[] ?? [];
    const idx     = params.idx as number[] ?? [];

    const colors = createColors(pointColoring.value, "rainbow", delta);

    let len = energy.length;
    points.value.length = 0;
    for(let i=0; i < len; ++i) {
        points.value.push({
            x: volume[i],
            y: energy[i],
            step: step[i],
            formula: formula[i],
            delta: delta[i],
            color: colors[i]
        });
    }

    line.value.length = 0;
    len = lineX.length;
    for(let i=0; i < len; ++i) {
        line.value.push({
            x: lineX[i],
            y: lineY[i],
            idx: idx[i]
        });
    }

    forceUpdate.value = !forceUpdate.value;
});

const stopWatcher = watch([colormapName, pointColoring], () => {

    const colors = createColors(pointColoring.value,
                                colormapName.value,
                                delta);

    const len = points.value.length;
    for(let i=0; i < len; ++i) {
        points.value[i].color = colors[i];
    }
    forceUpdate.value = !forceUpdate.value;
});

// Cleanup
onUnmounted(() => {
    stopWatcher();
});

/** Data for the legend */
const vc = computed(() => {
    return {
        min: lutMin.value.toFixed(4),
        max: lutMax.value.toFixed(4),
        colormap: colormapName.value
    };
});

// Accessors for the charts and hover popup
const xp = (d: DataRecord): number => d.x!;
const yp = (d: DataRecord): number => d.y!;
const cp = (d: DataRecord): string => d.color!;

const triggerFunction = (d: DataRecord): string => {

    return `
        <b>${d.formula}</b><br>
        <table>
        <tr><td>Step:</td><td class="rd">${d.step}</td></tr>
        <tr><td>Energy:</td><td class="rd">${d.y!.toFixed(4)}</td></tr>
        <tr><td>Distance:</td><td class="rd">${d.delta!.toFixed(4)}</td></tr>
        <tr><td>Volume:</td><td class="rd">${d.x!.toFixed(4)}</td></tr>
        </table>
    `;
};

const triggers = {
    [Scatter.selectors.point]: triggerFunction,
};

</script>


<template>
<v-app :theme class="layout-app">
  <VisXYContainer :margin="{right: 20, top: 20, left: 20, bottom: 20}"
                  :duration="0" class="layout-main ev-viewer">
    <VisLine :data="line" :x="xp" :y="yp" curveType="linear"/>
    <VisScatter :key="forceUpdate" :data="points" :x="xp" :y="yp"
                :color="cp" :size="9" cursor="pointer" />
    <VisAxis type="x" :gridLine="false" label="Cell volume (Å³)"
            labelColor="black" :labelFontSize="24" tickTextColor="black"/>
    <VisAxis type="y" :gridLine="false" label="Energy per structure (eV)"
            labelColor="black" :fullSize="true" :labelFontSize="24" tickTextColor="black"/>
    <VisTooltip :triggers :followCursor="false" />
  </VisXYContainer>
  <viewer-legend v-if="showLegend"
                :width="130" :height="200" :right="0" :top="0" :dark="true"
                title="Convex hull distance" :values-continue="vc"/>
  <v-container class="layout-buttons">
    <v-btn-toggle v-model="pointColoring" mandatory class="mr-4">
      <v-btn value="none" @click="showLegend=false">None</v-btn>
      <v-btn value="distance">Distance</v-btn>
    </v-btn-toggle>
    <v-switch v-model="showLegend" :disabled="pointColoring === 'none'" label="Show legend"/>
    <div style="width:200px">
      <select-colormap v-model="colormapName" class="mt-n1 ml-4"/>
    </div>
    <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
  </v-container>
</v-app>
</template>


<style scoped>

:deep(.rd) {
  text-align: right;
}

.ev-viewer {
 /* overflow: hidden;
  width: 100vw;
   flex: 2;
  padding: 0; */
  background-color: #90CEEC;

  --vis-axis-tick-color: black;
}

</style>
