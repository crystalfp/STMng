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
import {ref, shallowRef, useTemplateRef} from "vue";
import {Scatter} from "vue-chartjs";
import {Chart as ChartJS, Title, Tooltip, Legend, CategoryScale,
        LinearScale, PointElement, LineElement} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type {Context} from "chartjs-plugin-datalabels";
import log from "electron-log";
import {askNode, closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {theme} from "@/services/ReceiveTheme";
import type {ChartParams, ChartData, ChartOptions, CtrlParams} from "@/types";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ChartDataLabels,
    Title,
    Tooltip,
    Legend);

const emptyChartData = {
    datasets: []
};
const emptyChartOptions = {
    responsive: true,
    maintainAspectRatio: false
};
const chartOptions = shallowRef<ChartOptions>(emptyChartOptions);
const chartData = shallowRef<ChartData>(emptyChartData);
const chartType = ref("");
const transparent = ref(false);
const windowPath = "/chart";

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    const {data, options, type} = JSON.parse(params.chart as string ?? "{}") as ChartParams;

    chartType.value = type;
    chartData.value = data;

    if(data.labels && options.plugins) {
        options.plugins.datalabels = {
            formatter: (_value: unknown, context: Context): string =>
                context.chart.data.labels![context.dataIndex] as string
        };
    }

    chartOptions.value = options;
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Reference to the chart
 * @notExported
 */
interface ChartCanvas {
    chart: {
        canvas: HTMLCanvasElement;
    };
}
const chartElement = useTemplateRef<ChartCanvas>("chart");

/**
 * Make a chart snapshot
 *
 * @throws "Error"
 * Error saving chart snapshot
 */
const makeImage = (): void => {

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
};

/**
 * Save the chart point to a file
 */
const savePoints = (): void => {

    sendToNode("SYSTEM", "save-xrd");
};

</script>


<template>
<v-app :theme>
  <div class="chart-portal">
    <div class="chart-container">
      <Scatter
        ref="chart"
        :options="chartOptions"
        :data="chartData"
      />
    </div>
    <v-container class="button-strip">
      <v-btn @click="savePoints">Save points</v-btn>
      <v-btn @click="makeImage">Save image</v-btn>
      <v-switch v-model="transparent" label="Transparent" class="ml-4 mr-3"/>
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
