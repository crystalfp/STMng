<script setup lang="ts">
/**
 * @component
 * Show a chart in a secondary window.
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
import {closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";
import {VisXYContainer, VisLine, VisAxis, VisScatter} from "@unovis/vue";
import type {CtrlParams} from "@/types";

// const transparent = ref(false);

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

    showLabels.value = params.labelShow as boolean ?? false;
    if(showLabels.value) {
        len = labelX.length;
        for(let i=0; i < len; ++i) scatter.value.push({
            x: labelX[i],
            y: labelY[i],
            label: labelText[i]
        });
    }
    forceUpdate.value = !forceUpdate.value;
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Reference to the chart
 * @notExported
 */
// interface ChartCanvas {
//     chart: {
//         canvas: HTMLCanvasElement;
//     };
// }
// const chartElement = useTemplateRef<ChartCanvas>("chart");

/**
 * Make a chart snapshot
 *
 * @throws "Error"
 * Error saving chart snapshot
 */
const makeImage = (): void => {

    // Workaround for the save image
    sendToNode("SYSTEM", "save-png");

    /*
    if(chartElement.value) {

        const {canvas} = chartElement.value.chart;

        const ctx = canvas.getContext("2d");
        if(ctx) {
            ctx.save();
            ctx.globalCompositeOperation = "destination-over";
            if(transparent.value) {
                ctx.fillStyle = "transparent";
            }
            else {
                ctx.fillStyle = theme.value === "dark" ? "#121212" : "#FFFFFF";
            }
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        const dataURI = canvas.toDataURL("image/png");
        askNode("SYSTEM", "snapshot", {dataURI, format: "png"})
            .then((response) => {

                if(!transparent.value) {
                    const ctx2 = canvas.getContext("2d");
                    if(ctx2) {
                        ctx2.save();
                        ctx2.globalCompositeOperation = "destination-over";
                        ctx2.fillStyle = "transparent";
                        ctx2.fillRect(0, 0, canvas.width, canvas.height);
                        ctx2.restore();
                    }
                }

                if(response.error) throw Error(response.error as string);
            })
            .catch((error: Error) => {

                log.error(`Error saving chart snapshot: ${error.message}`);
            });
    }
    */
};

/**
 * Save the chart point to a file
 */
const savePoints = (): void => {

    sendToNode("SYSTEM", "save-xrd");
};

const curveType = computed(() => (lineSmooth.value ? "basis" : "step"));

</script>


<template>
<v-app :theme>
  <div class="chart-portal">
    <VisXYContainer :margin="{right: 20, top: 20, left: 20, bottom: 20}"
                    :scaleByDomain="true" :xDomain="range" class="chart-container">
      <VisLine :key="forceUpdate" :data="points" :x="xp" :y="yp" :curveType/>
      <VisScatter v-if="showLabels" :data="scatter" :x="xp" :y="yp"
                  color="red" :size="4"
                  :label="lp" labelColor="red" labelPosition="right" />
      <VisAxis type="x" :gridLine="false" label="2θ" :fullSize="true"
              :labelFontSize="24" numTicks="10"/>
      <VisAxis type="y" :gridLine="false" label="Intensity"
              :fullSize="true" :labelFontSize="24" />
    </VisXYContainer>
    <v-container class="button-strip">
      <v-btn @click="savePoints">Save points</v-btn>
      <v-btn @click="makeImage">Save image</v-btn>
      <!-- <v-switch v-model="transparent" label="Transparent" class="ml-4 mr-3"/> -->
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
  padding: 10px 10px 0 0;
}

</style>
