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
import {computed, onUnmounted, ref, watch} from "vue";
import log from "electron-log";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import {Scatter, BulletShape, XYLabels, type BulletLegendItemInterface} from "@unovis/ts";
import {VisXYContainer, VisScatter, VisAxis, VisLine, VisTooltip,
        VisBulletLegend, VisXYLabels} from "@unovis/vue";
import {Lut} from "three/addons/math/Lut.js";

import SelectColormap from "@/widgets/SelectColormap.vue";
import ViewerLegend from "@/widgets/ViewerLegend.vue";

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
    /** Points color */
    color?: string;
}

const points = ref<DataRecord[]>([]);
const line = ref<DataRecord[]>([]);
const vertex = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const dimension = ref(2);
const edges = ref<DataRecord[]>([]);

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

let dist: number[] = [];
let enthalpy: number[] = [];

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
    dist  = params.distance as number[];
    const step  = params.step as number[];
    const parts = params.parts as string[];
    const formula = params.formula as string[];
    enthalpy = params.e as number[];
    const tri = params.trianglesVertices as number[];

    const colors = createColors(pointColoring.value, "rainbow", enthalpy, dist);

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
            formula: formula[i],
            color: colors[i]
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

const triggerFunction = (d: DataRecord): string => {

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
};

const triggers = {
    [Scatter.selectors.point]: triggerFunction,
    [XYLabels.selectors.label]: triggerFunction,
};

// Chart legend
const legend = ref<BulletLegendItemInterface[]>([
    {name: "structures", color: "#03C03C", inactive: false},
    {name: "on the convex hull", color: "#FF0000",
     shape: BulletShape.Square, inactive: false},
    {name: "labels", color: "#598DFF", inactive: false},
]);
const position = computed(() => (dimension.value === 2 ? "left: 120px" : "left: 20px"));

type ColoringKind = "none" | "formation" | "distance";

const showStructures = ref(true);
const showOnLine = ref(true);
const showLegend = ref(false);
const showFormula = ref(true);
const pointColoring = ref<ColoringKind>("formation");
const colormapName = ref("rainbow");
const lutMin = ref(0);
const lutMax = ref(1);

/**
 * Toggle visibility of the chart items
 * Implementing the fix from: https://github.com/f5/unovis/issues/729#issuecomment-3850102309
 *
 * @param item - Legend item
 * @param which - Which legend item is selected
 */
const toggleItem = (item: BulletLegendItemInterface, which: number): void => {

    switch(which) {
        case 0:
            showStructures.value = item.inactive!;
            break;
        case 1:
            showOnLine.value = item.inactive!;
            break;
        case 2:
            showFormula.value = item.inactive!;
            break;
    }
    const updItems = [...legend.value];
    updItems[which] = {...item, inactive: !item.inactive};
    legend.value = updItems;
};

/**
 * Accessor for the label at the extreme of the range
 *
 * @param d - One data record
 */
const lp = (d: DataRecord): string => {

    // switch(d.parts) {
    //     case "1-0-0":
    //     case "0-1-0":
    //     case "0-0-1":
    //     case "1-0":
    //     case "0-1":
            return d.formula!.replaceAll(/<.?sub>/g, "");
    //     default:
    //         return "";
    // }
};

const cp = (d: DataRecord): string => d.color!;

/**
 * Make a chart snapshot
 */
const makeImage = (): void => {

    sendToNode("SYSTEM", "save-snapshot", {
        routerPath: windowPath,
        title: "Save chart snapshot",
        margin: 70
    });
};

/**
 * Create colormap for the point values (enthalpy or distance)
 *
 * @param kind - Coloring method
 * @param colormap - Name of the colormap to use
 * @param energy - Point enthalpies of formation
 * @param distance - Point distance from the convex hull
 */
const createColors = (kind: ColoringKind, colormap: string,
                      energy: number[], distance: number[]): string[] => {

    if(kind === "none") return Array<string>(energy.length).fill("#03C03C");
    const values = kind === "distance" ? distance : energy;

    let maxValue = Number.NEGATIVE_INFINITY;
    let minValue = Number.POSITIVE_INFINITY;
    for(const value of values) {
        if(value > maxValue) maxValue = value;
        if(value < minValue) minValue = value;
    }

    const lut = new Lut(colormap, 128);
    lut.setMax(maxValue);
    lut.setMin(minValue);
    lutMin.value = minValue;
    lutMax.value = maxValue;

    const vertexColors: string[] = [];
    for(const value of values) {

        vertexColors.push(`#${lut.getColor(value).getHexString()}`);
    }

    return vertexColors;
};

const stopWatcher = watch([colormapName, pointColoring], () => {

    const colors = createColors(pointColoring.value, colormapName.value,
                                enthalpy, dist);

    let len = points.value.length;
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

/** Set legend title */
const legendTitle = computed(() => {
    if(pointColoring.value === "distance") return "Distance";
    return "Enthalpy of formation";
});

</script>


<template>
<v-app :theme>
  <div class="hull-portal">
    <VisXYContainer v-if="dimension===2"
                    :margin="{right: 20, top: 20, left: 20, bottom: 20}"
                    :duration="0" class="hull-viewer">
      <VisLine :data="line" :x="xp" :y="yp" curveType="linear"/>
      <VisScatter v-if="showStructures" :key="forceUpdate" :data="points" :x="xp" :y="yp"
                  :color="cp" :size="7" cursor="pointer"/>
      <VisScatter v-if="showOnLine" :data="line" :x="xp" :y="yp"
                  color="#FF0000" :size="15" cursor="pointer" shape="square"/>
      <VisAxis type="x" :gridLine="false" label="Composition ratio"
              labelColor="black" :labelFontSize="24" tickTextColor="black"/>
      <VisAxis type="y" :gridLine="false" label="Enthalpy of formation (eV/atom)"
              labelColor="black" :fullSize="true" :labelFontSize="24" tickTextColor="black"/>
      <VisTooltip :triggers :followCursor="false" />
      <VisXYLabels v-if="showFormula" :data="line" :x="xp" :y="yp" :label="lp"
                   xPositioning="data_space" yPositioning="data_space"/>
    </VisXYContainer>
    <VisXYContainer v-else-if="dimension===3"
                    :margin="{right: 20, top: 20, left: 20, bottom: 20}"
                    :duration="0" class="hull-viewer">
      <VisLine :data="edges" :x="xp" :y="yp" curveType="linear" color="#000000"/>
      <VisLine :data="line" :x="xp" :y="yp" curveType="linear" :lineWidth="3"/>
      <VisScatter v-if="showStructures" :key="forceUpdate" :data="points" :x="xp" :y="yp"
                  :color="cp" :size="9" cursor="pointer"/>
      <VisScatter v-if="showOnLine" :data="vertex" :x="xp" :y="yp"
                  color="#FF0000" :size="15" cursor="pointer" shape="square"/>
      <VisTooltip :triggers :followCursor="false" />
      <VisXYLabels v-if="showFormula" :data="vertex" :x="xp" :y="yp" :label="lp"
                   xPositioning="data_space" yPositioning="data_space"/>
    </VisXYContainer>
    <v-alert v-else
         title="Not implemented"
         :text="`Visualization 2D for ${dimension}-components is not implemented`"
         type="error"
         color="red-darken-4"
         class="cursor-pointer" />
    <VisBulletLegend :items="legend" class="hull-legend" :style="position"
                     :onLegendItemClick="toggleItem" labelClassName="legend-color"
                     labelFontSize="medium" bulletSize="15px"/>
    <viewer-legend v-if="showLegend"
                 :width="130" :height="200" :right="0" :top="0" :dark="true"
                 :title="legendTitle" :values-continue="vc"/>
    <v-container class="hull-buttons">
      <v-btn-toggle v-model="pointColoring" mandatory>
        <v-btn value="none" @click="showLegend=false">None</v-btn>
        <v-btn value="formation">Formation</v-btn>
        <v-btn value="distance">Distance</v-btn>
      </v-btn-toggle>
      <v-switch v-model="showLegend" :disabled="pointColoring === 'none'" label="Show legend"/>
      <select-colormap v-model="colormapName" class="mt-n1"/>
      <v-btn @click="makeImage">Save image</v-btn>
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
  background-color: #90CEEC;

  --vis-axis-tick-color: black;
}

.hull-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: end;
}

.hull-legend {
    position: absolute;
    top: 10px;
    left: 120px;
}

:deep(.legend-color) {
  color: black;
}
</style>
