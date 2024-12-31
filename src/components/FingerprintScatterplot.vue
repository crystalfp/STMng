<script setup lang="ts">
/**
 * @component
 * Show scatterplot resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-26
 */
import {computed, onMounted, ref} from "vue";
import {Lut} from "three/addons/math/Lut.js";
import {closeWithEscape} from "@/services/CaptureEscape";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import {contrastingColors} from "@/electron/fingerprint/ContrastingColors";
import type {ScatterplotData} from "@/types";

interface Glyph {
    id: number;
    x: number;
    y: number;
    color: string;
}

/** The canvas sizes */
const scatterplotWidth = ref(500);
const scatterplotHeight = ref(300);

/** The scatterplot type */
const scatterplotType = ref("group");

/** The scatterplot parameters */
const pointRadius = ref(10);
const showPointRadius = ref(10);
const fgColor = computed(() => ((theme.value === "dark") ? "#808080" : "#121212"));

/** The received data */
let scatterplotData: ScatterplotData | null = null;
const scatterplotDataAvailable = ref(false);

/**
 * Convert a list of colors to RGB strings
 *
 * @param colors - The list of colors as [r, g, b] tuples
 */
const colorsToRGB = (colors: [r: number, g: number, b: number][]): string[] =>
    colors.map(([r, g, b]) => {
        const red =   Math.round((r * 255)).toString(16).padStart(2, "0");
        const green = Math.round((g * 255)).toString(16).padStart(2, "0");
        const blue  = Math.round((b * 255)).toString(16).padStart(2, "0");
        return `#${red}${green}${blue}`;
    });

/**
 * Return the points for the scatterplot colored by group
 */
const pointsByGroup = (): Glyph[] => {

    if(!scatterplotData?.countGroups || scatterplotData.points.length === 0) return [];

    // Prepare the list of contrasting colors
    const backgroundColor: [number, number, number] =
                (theme.value === "dark") ? [0.07059, 0.07059, 0.07059] : [1, 1, 1];
    const colorsRaw = contrastingColors(scatterplotData.countGroups, backgroundColor);
    const colors = colorsToRGB(colorsRaw);

    // Map each point to a glyph
    const {points, groups, id} = scatterplotData;
    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        // Get the color corresponding to the group of the point
        const color = colors[groups[i]];

        out.push({
            id: id[i],
            x: Math.round(points[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-points[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
        });
    }
    return out;
};

/**
 * Return the points for the scatterplot colored by energy
 */
const pointsByEnergy = (): Glyph[] => {

    if(!scatterplotData || scatterplotData.points.length === 0) return [];

    // Map each point to a glyph
    const {points, energies, id} = scatterplotData;

    // Extract the energy range
    let minEnergy = energies[0];
    let maxEnergy = minEnergy;
    for(let i=1; i < energies.length; ++i) {
        if(energies[i] < minEnergy) minEnergy = energies[i];
        if(energies[i] > maxEnergy) maxEnergy = energies[i];
    }

    // Generate the colormap
    const lut = (maxEnergy - minEnergy) < 1e-10 ? undefined : new Lut("rainbow", 512);
    if(lut) {
        lut.setMin(minEnergy);
        lut.setMax(maxEnergy);
    }

    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        const color = lut ? `#${lut.getColor(energies[i]).getHexString()}` : "#0000FF";

        out.push({
            id: id[i],
            x: Math.round(points[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-points[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
        });
    }
    return out;
};

/**
 * Return the points for the scatterplot colored by efficiency
 */
const pointsByEfficiency = (): Glyph[] => {

    if(!scatterplotData || scatterplotData.efficiencies.length === 0) return [];

    // Map each point to a glyph
    const {efficiencies} = scatterplotData;

    // Extract the distance from the diagonal
    let minDelta = efficiencies[0][1] - efficiencies[0][0];
    let maxDelta = minDelta;
    for(let i=1; i < efficiencies.length; ++i) {
        const delta = efficiencies[i][1] - efficiencies[i][0];
        if(delta < minDelta) minDelta = delta;
        if(delta > maxDelta) maxDelta = delta;
    }
    if(minDelta < 0) minDelta = -minDelta;
    if(maxDelta < 0) maxDelta = -maxDelta;
    maxDelta = Math.max(maxDelta, minDelta);

    // Generate the colormap
    const lut = maxDelta < 1e-10 ? undefined : new Lut("blackbody", 512);
    if(lut) {
        lut.setMin(0);
        lut.setMax(maxDelta);
    }

    const n = efficiencies.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        let delta = efficiencies[i][1] - efficiencies[i][0];
        if(delta < 0) delta = -delta;

        const color = lut ? `#${lut.getColor(delta).getHexString()}` : "#0000FF";

        out.push({
            id: -i-1,
            x: Math.round(efficiencies[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-efficiencies[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
        });
    }
    return out;
};

const scatterplotPoints = computed<Glyph[]>(() => {

    if(scatterplotDataAvailable.value) scatterplotDataAvailable.value = false;
// console.log(JSON.stringify(scatterplotData, undefined, 2));
    switch(scatterplotType.value) {
        case "energy": return pointsByEnergy();
        case "efficiency": return pointsByEfficiency();
        // case "group": return pointsByGroup();
        default: return pointsByGroup();
    }
});

onMounted(() => {

    // Get the canvas size
    const canvas = document.querySelector<HTMLDivElement>(".scatterplot-viewer");
    if(!canvas) return;

    scatterplotWidth.value = canvas.clientWidth;
    scatterplotHeight.value = canvas.clientHeight;

    // Adjust the canvas size on window resize
    let timer: NodeJS.Timeout;
    globalThis.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            scatterplotWidth.value = canvas.clientWidth;
            scatterplotHeight.value = canvas.clientHeight;
        }, 200);
    });
});

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    scatterplotData = JSON.parse(dataFromMain) as ScatterplotData;
    scatterplotDataAvailable.value = true;
});

/** Close the window on Esc press */
closeWithEscape("/scatter");

/**
 * On selecting a point
 *
 * @param id - The id of the selected point
 */
const selectPoint = (id: number): void => {

    if(id < 0) return;
    console.log("Selected point:", id); // TBD
};
</script>


<template>
<v-app :theme="theme">
  <div class="scatterplot-portal">
    <div class="scatterplot-viewer">
      <svg :width="scatterplotWidth" :height="scatterplotHeight" x="0" y="0"
          :viewBox="`0 0 ${scatterplotWidth} ${scatterplotHeight}`" fill="transparent"
          xmlns="http://www.w3.org/2000/svg">
        <circle v-for="n of scatterplotPoints" :key="n.id" :cx="n.x" :cy="n.y"
                :r="pointRadius" :style="{fill: n.color}" @click="selectPoint(n.id)"/>
        <rect x="20" y="20" :width="scatterplotWidth-40" :height="scatterplotHeight-40" :stroke="fgColor"/>
        <line v-if="scatterplotType==='efficiency'"
              x1="20" :y1="scatterplotHeight-20" :x2="scatterplotWidth-20" y2="20" :stroke="fgColor"
              stroke-dasharray="6 4"/>
      </svg>
    </div>
  <v-container class="button-strip scatterplot-buttons">
    <v-btn-toggle v-model="scatterplotType" mandatory>
      <v-btn value="group">Group</v-btn>
      <v-btn value="energy">Energy</v-btn>
      <v-btn value="efficiency">Efficiency</v-btn>
    </v-btn-toggle>
    <g-slider-with-steppers v-model="pointRadius"
                          v-model:raw="showPointRadius" label-width="8rem"
                          :label="`Point radius (${showPointRadius})`"
                          :min="3" :max="20" :step="1" />
    <v-btn v-focus @click="closeWindow('/scatter')">Close</v-btn>
  </v-container>
  </div>
</v-app>
</template>


<style scoped>

.scatterplot-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
}

.scatterplot-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}

.scatterplot-buttons {
  height: fit-content;
  justify-content: space-between;
}
</style>
