<script setup lang="ts">
/**
 * @component
 * Display convex hull for variable composition results
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-29
 */
import {ref} from "vue";
import log from "electron-log";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import type {CtrlParams} from "@/types";

import {Scatter} from "@unovis/ts";
import {VisXYContainer, VisScatter, VisAxis, VisLine, VisTooltip} from "@unovis/vue";

const windowPath = "/components-hull";

/**
 * Chart data
 * @notExported
 */
interface DataRecord {
    /** X value */
    x: number;
    /** Y value */
    y: number;
    /** Distance from the convex hull */
    dist?: number;
    /** Corresponding step in the loaded sequence */
    step?: number;
    /** Composition of the structure */
    parts?: string;
}

const points = ref<DataRecord[]>([]);
const line = ref<DataRecord[]>([]);
const forceUpdate = ref(true);
const dimension = ref(2);

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
    const dataY = params.y as number[];
    const dist  = params.distance as number[];
    const step  = params.step as number[];
    const parts = params.parts as string[];

    let len = dataX.length;
    points.value.length = 0;
    for(let i=0; i < len; ++i) {
        points.value.push({
            x: dataX[i],
            y: dataY[i],
            dist: dist[i],
            step: step[i],
            parts: parts[i],
        });
    }

    // Collect values for the convex hull line and vertices
    const vertices    = params.vertices as number[];
    const idxVertices = params.idxVertices as number[];
    len = vertices.length;
    line.value.length = 0;
    for(let i=0; i < len; i+=2) {
        const idx = idxVertices[i/2];
        line.value.push({x: vertices[i], y: vertices[i+1],
                         step: step[idx], parts: parts[idx]});
    }
    forceUpdate.value = !forceUpdate.value;
});

// Accessors for the charts
const xp = (d: DataRecord): number => d.x;
const yp = (d: DataRecord): number => d.y;
const triggers = {
    [Scatter.selectors.point]: (d: DataRecord) => {

        if(d.dist === undefined) return `
            Step: ${d.step}<br>
            Composition: ${d.parts!.replaceAll("-", ":")}<br>
            Enthalpy of formation: ${d.y.toFixed(4)}<br>
            Distance from convex hull: 0.0000
        `;
        return `
            Step: ${d.step}<br>
            Composition: ${d.parts!.replaceAll("-", ":")}<br>
            Enthalpy of formation: ${d.y.toFixed(4)}<br>
            Distance from convex hull: ${d.dist.toFixed(4)}
        `;
    }
};

</script>


<template>
<v-app :theme>
  <div class="hull-portal">
    <VisXYContainer v-if="dimension===2" :margin="{right: 20, top: 20, left: 20}" class="hull-viewer">
      <VisLine :key="forceUpdate" :data="line" :x="xp" :y="yp" curveType="linear"/>
      <VisScatter :data="points" :x="xp" :y="yp" color="#00FF00" :size="7" cursor="pointer"/>
      <VisScatter :data="line" :x="xp" :y="yp" color="#FF0000" :size="15" cursor="pointer" shape="square"/>
      <VisAxis type="x" :gridLine="false" label="Composition ratio"
              :labelFontSize="24"/>
      <VisAxis type="y" :gridLine="false" label="Enthalpy of formation (eV/atom)"
              :fullSize="true" :labelFontSize="24"/>
      <VisTooltip :triggers :followCursor="false" />
    </VisXYContainer>
    <v-alert v-else
         title="Not implemented yet"
         :text="`Visualization for ${dimension} components not implemented`"
         type="error"
         color="red-darken-4"
         class="cursor-pointer" />
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
  min-width: 1100px;
  padding: 0;
}

.hull-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}

.hull-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: end;
  align-items: baseline
}

</style>
