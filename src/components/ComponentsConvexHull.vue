<script setup lang="ts">
/**
 * @component
 * Display convex hull for variable composition results
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-29
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
import log from "electron-log";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import {Scatter, BulletShape, type BulletLegendItemInterface} from "@unovis/ts";
import {VisXYContainer, VisScatter, VisAxis, VisLine, VisTooltip,
        VisBulletLegend} from "@unovis/vue";

const windowPath = "/components-hull";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    x: number | undefined;
    /** Y value */
    y: number | undefined;
    /** Distance from the convex hull */
    dist?: number;
    /** Corresponding step in the loaded sequence */
    step?: number;
    /** Composition of the structure */
    parts?: string;
    /** Enthalpy of formation */
    enthalpy?: number;
    /** Chemical formula */
    formula?: string;
}

const points = ref<DataRecord[]>([]);
const line = ref<DataRecord[]>([]);
const vertex = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const dimension = ref(2);
const edges = ref<DataRecord[]>([]);

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    // Error handling
    if(params?.error) {
        log.error(`Error requesting data for "${windowPath}". Error: ${params.error as string}`);
        return;
    }

    // Number of components
    dimension.value = params.dimension as number ?? 2;

    // Collect values for the scatterplot
    const dataX = params.x as number[];
    const dataY = dimension.value === 2 ? params.e as number[] : params.y as number[];
    const dist  = params.distance as number[];
    const step  = params.step as number[];
    const parts = params.parts as string[];
    const formula = params.formula as string[];
    const enthalpy = params.e as number[];
    const tri = params.trianglesVertices as number[];

    let len = dataX.length;
    points.value.length = 0;
    for(let i=0; i < len; ++i) {
        points.value.push({
            x: dataX[i],
            y: dataY[i],
            dist: dist[i],
            step: step[i],
            parts: parts[i],
            enthalpy: enthalpy[i],
            formula: formula[i]
        });
    }

    // Collect values for the convex hull line and vertices
    const vertices    = params.vertices as number[];
    const idxVertices = params.idxVertices as number[];
    switch(dimension.value) {
        case 2:
            len = vertices.length;
            line.value.length = 0;
            for(let i=0; i < len; i+=2) {
                const idx = idxVertices[i/2];
                line.value.push({x: vertices[i], y: vertices[i+1],
                                step: step[idx], parts: parts[idx],
                                enthalpy: vertices[i+1], formula: formula[idx]});
            }
            break;
        case 3:
            line.value.length = 0;
            line.value.push({x: 0,   y: 0},
                            {x: 1,   y: 0},
                            {x: 0.5, y: 0.8660254038}, // √3/2
                            {x: 0,   y: 0});
            vertex.value.length = 0;
            len = vertices.length;
            for(let i=0; i < len; i+=3) {
                const idx = idxVertices[i/3];
                vertex.value.push({x: vertices[i], y: vertices[i+1],
                                   step: step[idx], parts: parts[idx],
                                   enthalpy: vertices[i+2], formula: formula[idx]});
            }
            edges.value.length = 0;
            len = tri.length;
            for(let i=0; i < len; i+=9) {
                if(i > 0) edges.value.push(
                    {x: undefined, y: undefined},
                );
                edges.value.push(
                    {x: tri[i],    y: tri[i+1]},
                    {x: tri[i+3],  y: tri[i+4]},
                    {x: tri[i+6],  y: tri[i+7]},
                    {x: tri[i],    y: tri[i+1]},
                );
            }
            break;
        default:
            break;
    }
    forceUpdate.value = !forceUpdate.value;
});

// Accessors for the charts and hover popup
const xp = (d: DataRecord): number => d.x!;
const yp = (d: DataRecord): number => d.y!;
const triggers = {
    [Scatter.selectors.point]: (d: DataRecord) => {

        if(d.dist === undefined) return `
            <b>${d.formula!}</b><br>
            Step: ${d.step}<br>
            Composition: ${d.parts!.replaceAll("-", ":")}<br>
            Enthalpy of formation: ${d.enthalpy!.toFixed(4)}<br>
            Distance from convex hull: 0.0000
        `;
        return `
            <b>${d.formula!}</b><br>
            Step: ${d.step}<br>
            Composition: ${d.parts!.replaceAll("-", ":")}<br>
            Enthalpy of formation: ${d.enthalpy!.toFixed(4)}<br>
            Distance from convex hull: ${d.dist.toFixed(4)}
        `;
    }
};

// Chart legend
const legend = ref<BulletLegendItemInterface[]>([
    {name: "structures", color: "#03C03C", inactive: false},
    {name: "structures on the convex hull", color: "#FF0000",
     shape: BulletShape.Square, inactive: false}
]);
const position = computed(() => (dimension.value === 2 ? "left: 120px" : "left: 20px"));

const showStructures = ref(true);
const showOnLine = ref(true);

/**
 * Toggle visibility of the chart items
 * Implementing the fix from: https://github.com/f5/unovis/issues/729#issuecomment-3850102309
 *
 * @param item - Legend item
 * @param which - Which legend item is selected
 */
const toggleItem = (item: BulletLegendItemInterface, which: number): void => {

    if(which === 0) showStructures.value = item.inactive!;
    else if(which === 1) showOnLine.value = item.inactive!;

    const updItems = [...legend.value];
    updItems[which] = {...item, inactive: !item.inactive};
    legend.value = updItems;
};

</script>


<template>
<v-app :theme>
  <div class="hull-portal">
    <VisXYContainer v-if="dimension===2"
                    :margin="{right: 20, top: 20, left: 20, bottom: 20}" class="hull-viewer">
      <VisLine :key="forceUpdate" :data="line" :x="xp" :y="yp" curveType="linear"/>
      <VisScatter v-if="showStructures" :data="points" :x="xp" :y="yp"
                  color="#03C03C" :size="7" cursor="pointer"/>
      <VisScatter v-if="showOnLine" :data="line" :x="xp" :y="yp"
                  color="#FF0000" :size="15" cursor="pointer" shape="square"/>
      <VisAxis type="x" :gridLine="false" label="Composition ratio"
              :labelFontSize="24"/>
      <VisAxis type="y" :gridLine="false" label="Enthalpy of formation (eV/atom)"
              :fullSize="true" :labelFontSize="24" />
      <VisTooltip :triggers :followCursor="false" />
    </VisXYContainer>
    <VisXYContainer v-else-if="dimension===3"
                    :margin="{right: 20, top: 20, left: 20, bottom: 20}" class="hull-viewer">
      <VisLine :key="forceUpdate" :data="edges" :x="xp" :y="yp" curveType="linear" color="#000000"/>
      <VisLine :key="forceUpdate" :data="line" :x="xp" :y="yp" curveType="linear" :lineWidth="3"/>
      <VisScatter v-if="showStructures" :data="points" :x="xp" :y="yp"
                  color="#03C03C" :size="9" cursor="pointer"/>
      <VisScatter v-if="showOnLine" :data="vertex" :x="xp" :y="yp"
                  color="#FF0000" :size="15" cursor="pointer" shape="square"/>
      <VisTooltip :triggers :followCursor="false" />
    </VisXYContainer>
    <v-alert v-else
         title="Not implemented yet"
         :text="`Visualization for ${dimension} components not implemented`"
         type="error"
         color="red-darken-4"
         class="cursor-pointer" />
    <VisBulletLegend :items="legend" class="hull-legend" :style="position"
                     :onLegendItemClick="toggleItem"
                     labelFontSize="medium" bulletSize="15px"/>
    <v-container class="hull-buttons">
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </div>
</v-app>
</template>


<style scoped>
.hull-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 800px;
  padding: 0;
}

.hull-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
  background-color: #E3E3E3;
}

.hull-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: end;
  align-items: baseline
}

.hull-legend {
    position: absolute;
    top: 10px;
    left: 120px;
    /* left: 20px; */
}
</style>
