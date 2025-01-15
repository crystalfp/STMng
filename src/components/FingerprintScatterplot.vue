<script setup lang="ts">
/**
 * @component
 * Show the scatterplot resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-26
 */
import {computed, onMounted, ref} from "vue";
import {Lut} from "three/addons/math/Lut.js";
import {closeWithEscape} from "@/services/CaptureEscape";
import {closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import {contrastingColors} from "@/electron/fingerprint/ContrastingColors";
import type {ScatterplotData} from "@/types";

/** One point that goes to the scatterplot */
interface Glyph {

    /** The original step number or sequence number for efficiency display */
    id: number;

    /** X screen coordinate */
    x: number;

    /** Y screen coordinate */
    y: number;

    /** The color of the point as "#RRGGBB" */
    color: string;

    /** Value associated to the point: group, energy, or delta for efficiency */
    value: number;
}

/** The canvas sizes (will be computed during mount or resize) */
const scatterplotWidth = ref(500);
const scatterplotHeight = ref(300);

/** The scatterplot type */
const scatterplotType = ref("group");

/** The scatterplot parameters */
const pointRadius = ref(10);
const showPointRadius = ref(10);
const fgColor = "#575757";

/** The received data */
let scatterplotData: ScatterplotData | undefined;
const scatterplotDataAvailable = ref(false);

/** The group colors */
let groupColors: string[] = [];

/** The energy range */
let minEnergy = 0;
let maxEnergy = 0;

/**
 * Convert a list of colors to RGB strings
 *
 * @param colors - The list of colors as [r, g, b] tuples with values between 0 and 1
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
 *
 * @returns The list of points as glyphs
 */
const pointsByGroup = (): Glyph[] => {

    if(!scatterplotData || scatterplotData.points.length === 0) return [];

    const oneGroup = scatterplotData.countGroups === 0;
    if(!oneGroup) {
        // Prepare the list of contrasting colors
        const backgroundColor: [number, number, number] =
                    (theme.value === "dark") ? [0.07059, 0.07059, 0.07059] : [1, 1, 1];
        const colorsRaw = contrastingColors(scatterplotData.countGroups, backgroundColor);
        groupColors = colorsToRGB(colorsRaw);
    }

    // Map each point to a glyph
    const {points, groups, id} = scatterplotData;
    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        // Get the color corresponding to the group of the point
        const color = oneGroup ? "#0000FF" : groupColors[groups[i]];

        out.push({
            id: id[i],
            x: Math.round(points[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-points[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
            value: groups[i],
        });
    }
    return out;
};

/**
 * Return the points for the scatterplot colored by energy
 *
 * @returns The list of points as glyphs
 */
const pointsByEnergy = (): Glyph[] => {

    if(!scatterplotData || scatterplotData.points.length === 0) return [];

    // Map each point to a glyph
    const {points, energies, id} = scatterplotData;

    // Extract the energy range
    minEnergy = energies[0];
    maxEnergy = minEnergy;
    for(let i=1; i < energies.length; ++i) {
        if(energies[i] < minEnergy) minEnergy = energies[i];
        if(energies[i] > maxEnergy) maxEnergy = energies[i];
    }

    // Generate the colormap
    const lut = (maxEnergy - minEnergy) < 1e-10 ? undefined : new Lut("blackbody", 512);
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
            value: energies[i],
        });
    }
    return out;
};

let overallQuality = 0;
/**
 * Return the points for the scatterplot colored by efficiency
 * - X axis is the original distance
 * - Y axis is the distance after the projection
 *
 * @returns The list of points as glyphs
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
        lut.setMax(1);
    }

    overallQuality = 0;
    const n = efficiencies.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        let delta = efficiencies[i][1] - efficiencies[i][0];
        const value = delta;
        if(delta < 0) delta = -delta;
        overallQuality += delta;

        const color = lut ? `#${lut.getColor(1-delta).getHexString()}` : "#0000FF";

        out.push({
            id: i,
            x: Math.round(efficiencies[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-efficiencies[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
            value,
        });
    }

    overallQuality /= n;

    return out;
};

/**
 * Return the points for the scatterplot colored by the silhouette coefficient
 *
 * @returns The list of points as glyphs
 */
 const pointsBySilhouettes = (): Glyph[] => {

    if(!scatterplotData || scatterplotData.silhouettes.length === 0) return [];

    // Map each point to a glyph
    const {points, silhouettes, id} = scatterplotData;
    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        // Get the color corresponding to the silhouette coefficient of the point
        const sl = silhouettes[i];

        let color;
        if(sl < -0.05)     color = "#bd0000";
        else if(sl < 0)    color = "white";
        else if(sl === 0)  color = "#7d0075";
        else if(sl < 0.05) color = "white";
        else if(sl < 0.25) color = "red";
        else if(sl < 0.5)  color = "orange";
        else if(sl < 0.7)  color = "yellow";
        else               color = "green";

        out.push({
            id: id[i],
            x: Math.round(points[i][0] * (scatterplotWidth.value - 40) + 20),
            y: Math.round((1-points[i][1]) * (scatterplotHeight.value - 40) + 20),
            color,
            value: sl
        });
    }
    return out;
};

/** Compute the list of points to be shown */
const scatterplotPoints = computed<Glyph[]>(() => {

    // Needed to force the reactivity
    if(scatterplotDataAvailable.value) scatterplotDataAvailable.value = false;

    // Hide the text if any and deselect all points
    textShow.value = false;
    selectedPoints.value.length = 0;

    // Compute the points
    switch(scatterplotType.value) {
        case "energy": return pointsByEnergy();
        case "efficiency": return pointsByEfficiency();
        case "group": return pointsByGroup();
        case "silhouette": return pointsBySilhouettes();
        default: return [];
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

/** The info associated to the clicked point */
const textShow  = ref(false);
const textX     = ref(0);
const textY     = ref(0);
const textLine1 = ref("");
const textLine2 = ref("");

/** Indices of the selected points */
const selectedPoints = ref<number[]>([]);
const noSelectedPoints = computed(() => selectedPoints.value.length === 0);

/**
 * On selecting a point
 *
 * @param idx - The index of the selected point
 */
const selectPoint = (idx: number): void => {

    // Do not allow selection of points in efficiency mode
    if(scatterplotType.value === "efficiency") return;

    // If the point is already selected, remove it; otherwise add it
    const i = selectedPoints.value.indexOf(idx);
    if(i === -1) selectedPoints.value.push(idx);
    else {
        selectedPoints.value.splice(i, 1);
        textShow.value = false;
        return;
    }

    // Prepare the text to show and move it to remain inside the plot
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const {x, y, value} = scatterplotPoints.value[idx];
    let valueLine = "";
    switch(scatterplotType.value) {
        case "group":       valueLine = `Group: ${value}`; break;
        case "energy":      valueLine = `Energy: ${value.toFixed(3)}`; break;
        case "silhouette":  valueLine = `Silhouette: ${value.toFixed(2)}`; break;
    }
    textX.value = x > scatterplotWidth.value - 50 ? x-110 : x+pointRadius.value+10;
    textY.value = y > scatterplotHeight.value - 50 ? y-32 : y+6;
    textLine1.value = `Step: ${idx}`;
    textLine2.value = valueLine;
    textShow.value  = true;
};

/**
 * Reset the selected points
 */
const resetSelected = (): void => {
    selectedPoints.value.length = 0;
    textShow.value = false;
};

/** Point selection markers for display */
const selectionMarkers = computed(() => selectedPoints.value.map((idx) => scatterplotPoints.value[idx]));

/** Rectangular point selection (with right mouse button) */
const x = ref(0);
const y = ref(0);
const width = ref(0);
const height = ref(0);
let rectangleStartX: number | undefined;
let rectangleStartY: number | undefined;
const showSelectionRectangle = ref(false);

/**
 * Right mouse button down event: start rectangular selection
 *
 * @param event - The mouse event
 */
const mousedown = (event: MouseEvent): void => {

    if(event.button !== 2) return;

    rectangleStartX = event.clientX;
    rectangleStartY = event.clientY;
    showSelectionRectangle.value = true;
    width.value = 0;
    height.value = 0;
};

/**
 * Right mouse button up event: end selection
 *
 * @param event - The mouse event
 */
const mouseup = (event: MouseEvent): void => {

    if(event.button !== 2) return;
    if(rectangleStartX === undefined || rectangleStartY === undefined) return;

    let rectangleEndX = event.clientX;
    let rectangleEndY = event.clientY;

    if(rectangleEndX < rectangleStartX) {
        const tt = rectangleEndX;
        rectangleEndX = rectangleStartX;
        rectangleStartX = tt;
    }

    if(rectangleEndY < rectangleStartY) {
        const tt = rectangleEndY;
        rectangleEndY = rectangleStartY;
        rectangleStartY = tt;
    }

    let idx = 0;
    textShow.value = false;
    if(event.ctrlKey) {
        for(const point of scatterplotPoints.value) {
            if(point.x >= rectangleStartX && point.x <= rectangleEndX &&
               point.y >= rectangleStartY && point.y <= rectangleEndY) {
                const i = selectedPoints.value.indexOf(idx);
                if(i !== -1) selectedPoints.value.splice(i, 1);
            }
            ++idx;
        }
    }
    else {
        for(const point of scatterplotPoints.value) {
            if(point.x >= rectangleStartX && point.x <= rectangleEndX &&
               point.y >= rectangleStartY && point.y <= rectangleEndY &&
               !selectedPoints.value.includes(idx)) selectedPoints.value.push(idx);
            ++idx;
        }
    }
    rectangleStartX = undefined;
    rectangleStartY = undefined;
    showSelectionRectangle.value = false;
};

let lastMoveEvent: number | undefined;
/**
 * Move the mouse to change the rectangular selection area
 *
 * @param event - The mouse event
 */
const mousemove = (event: MouseEvent): void => {

    // Selection not started or not active
    if(!showSelectionRectangle.value ||
       rectangleStartX === undefined ||
       rectangleStartY === undefined) return;

    // Avoid too many events
    if(lastMoveEvent && (event.timeStamp - lastMoveEvent) < 100) return;
    lastMoveEvent = event.timeStamp;

    const rectangleEndX = event.clientX;
    const rectangleEndY = event.clientY;

    // Reorder coordinates if needed
    if(rectangleEndX < rectangleStartX) {
        x.value = rectangleEndX;
        width.value = rectangleStartX - rectangleEndX;
    }
    else {
        x.value = rectangleStartX;
        width.value = rectangleEndX - rectangleStartX;
    }

    if(rectangleEndY < rectangleStartY) {
        y.value = rectangleEndY;
        height.value = rectangleStartY - rectangleEndY;
    }
    else {
        y.value = rectangleStartY;
        height.value = rectangleEndY - rectangleStartY;
    }
};

/** Selected all points pertaining to a group */
const showSelect = ref(false);
const selectedGroup = ref(0);
const showSelectedGroup = ref(0);

/**
 * Selected all points pertaining to a group
 */
const selectByGroup = (): void => {

    if(!scatterplotData ||
        scatterplotData.countGroups === 0) return;

    const cnt = scatterplotData.groups.length;
    if(!cnt) return;

    for(let i=0; i < cnt; ++i) {
        if(scatterplotData.groups[i] === selectedGroup.value &&
           !selectedPoints.value.includes(i)) {
                selectedPoints.value.push(i);
        }
    }
};

/**
 * Select all points
 */
const selectAll = ():void => {

  if(!scatterplotData) return;

    const cnt = scatterplotData.points.length;
    if(!cnt) return;

    selectedPoints.value.length = cnt;
    for(let i=0; i < cnt; ++i) selectedPoints.value[i] = i;
};

// > Save selected to the selected file name

const showSave = ref(false);

/**
 * Save selected to the selected file name
 *
 * @param filename - Selected filename
 */
const selectedSaveFile = (filename: string): void => {

    if(filename) {

        sendToNode("SYSTEM", "selected-points", {
            filename,
            points: JSON.stringify(selectedPoints.value),
        });
    }
    showSave.value = false;
};

const filterPOSCAR = JSON.stringify([{name: "POSCAR", extensions: ["poscar"]},
                                     {name: "All",    extensions: ["*"]}]);

// > Compare structures selected
const compareSelected = (): void => {

    notImplemented.value = !notImplemented.value;
};
const notImplemented = ref(false);

/**
 * Select by min energy in each group
 */
const selectByGroupMinEnergy = (): void => {

    if(!scatterplotData ||
        scatterplotData.countGroups === 0 ||
        scatterplotData.energies.length === 0) return;

    const npoints = scatterplotData.groups.length;
    if(!npoints) return;

    // For each group
    for(let group=0; group < scatterplotData.countGroups; ++group) {

        let minEnergyValue = Number.POSITIVE_INFINITY;
        let minEnergyIdx = 0;

        for(let j=0; j < npoints; ++j) {

            if(scatterplotData.groups[j] === group &&
               scatterplotData.energies[j] < minEnergyValue) {
                minEnergyValue = scatterplotData.energies[j];
                minEnergyIdx = j;
            }
        }

        if(!selectedPoints.value.includes(minEnergyIdx)) {
            selectedPoints.value.push(minEnergyIdx);
        }
    }
};

const showLegend = ref(false);
const showLegendDiscrete = computed(() => showLegend.value &&
                                          (scatterplotType.value === "group" ||
                                           scatterplotType.value === "silhouette"));
const showLegendContinue = computed(() => showLegend.value &&
                                          (scatterplotType.value === "energy" ||
                                           scatterplotType.value === "efficiency"));

const legendDiscrete = computed<{key: number; color: string; label: string}[]>(() => {

    if(scatterplotType.value === "group") {
        if(!scatterplotData || scatterplotData.countGroups === 0) {
            return [{key: 0, color: "#0000FF", label: "No groups"}];
        }
        const out = [];
        let group = 0;
        for(const color of groupColors) {
            out.push({key: group, color, label: `Group ${group}`});
            ++group;
        }
        return out;
    }
    else if(scatterplotType.value === "silhouette") {
        return [
            {key: 0, color: "green",   label: "Strong"},
            {key: 1, color: "yellow",  label: "Reasonable"},
            {key: 2, color: "orange",  label: "Weak"},
            {key: 3, color: "red",     label: "Bad"},
            {key: 4, color: "#bd0000", label: "Very bad"},
            {key: 5, color: "#7d0075", label: "Group of one element"},
            {key: 6, color: "white",   label: "Across groups border"},
        ];
    }

    return [];
});

// Create the color scale for the legend
const lut2 = new Lut("blackbody", 256);
const colorScale = lut2.createCanvas().toDataURL();

const legendContinue = computed(() => {
    if(scatterplotType.value === "energy") {
        return {
            min: minEnergy.toFixed(4),
            max: maxEnergy.toFixed(4),
            header: "Energy",
            footer: ""
        };
    }
    else if(scatterplotType.value === "efficiency") {
        return {
            min: "1.0000",
            max: "0.0000",
            header: "Distance from diagonal",
            footer: `Mean: ${overallQuality.toFixed(2)}`
        };
    }
    return {
        min: "0.0000",
        max: "1.0000",
        header: "",
        footer: ""
    };
});

</script>


<template>
<v-app :theme="theme">
  <div class="scatterplot-portal">
    <div class="scatterplot-viewer">
      <svg :width="scatterplotWidth" :height="scatterplotHeight" x="0" y="0"
          :viewBox="`0 0 ${scatterplotWidth} ${scatterplotHeight}`" fill="transparent"
          xmlns="http://www.w3.org/2000/svg" @click="textShow=false"
          @mousedown="mousedown" @mouseup="mouseup" @mousemove="mousemove">
        <rect v-if="showSelectionRectangle" :x :y :width :height stroke="red" stroke-width="2"/>
        <rect x="20" y="20" :width="scatterplotWidth-40" :height="scatterplotHeight-40"
              fill="none" :stroke="fgColor"/>
        <line v-if="scatterplotType==='efficiency'"
              x1="20" :y1="scatterplotHeight-20" :x2="scatterplotWidth-20" y2="20" :stroke="fgColor"
              stroke-dasharray="6 4" pointer-event="none"/>
        <circle v-for="n of selectionMarkers" :key="n.id" :cx="n.x" :cy="n.y" pointer-event="none"
                :r="pointRadius+5" stroke-width="2" :style="{stroke: n.color}" />
        <circle v-for="(n, index) of scatterplotPoints" :key="n.id" :cx="n.x" :cy="n.y"
                :r="pointRadius" :style="{fill: n.color}"
                @click.stop="selectPoint(index)"/>
        <text v-if="textShow" :x="textX" :y="textY" :fill="fgColor">
            <tspan :x="textX">{{ textLine1 }}</tspan>
            <tspan :x="textX" dy="20">{{ textLine2 }}</tspan>
        </text>
      </svg>
      <div v-if="showLegendDiscrete" class="legend">
        <div v-for="n of legendDiscrete" :key="n.key">
          <span style="width: 150px" :style="{backgroundColor: n.color, color: n.color}">⬚</span> {{ n.label }}</div>
      </div>
      <div v-if="showLegendContinue" class="legend narrow">
        <p>{{ legendContinue.header }}</p>
        <table class="tg"><tbody>
        <tr>
          <td class="td-bottom" rowspan="2"><img :src="colorScale" height="150" width="30"></td>
          <td class="td-top pt-1">{{ legendContinue.max }}</td>
        </tr>
        <tr>
          <td class="td-bottom pb-3">{{ legendContinue.min }}</td>
        </tr>
        </tbody></table>
        <p>{{ legendContinue.footer }}</p>
      </div>
    </div>
    <v-container class="scatterplot-buttons">
      <div class="buttons-line">
        <v-btn-toggle v-model="scatterplotType" mandatory>
          <v-btn value="group">Group</v-btn>
          <v-btn value="energy">Energy</v-btn>
          <v-btn value="efficiency">Fidelity</v-btn>
          <v-btn value="silhouette">Quality</v-btn>
        </v-btn-toggle>
        <g-slider-with-steppers v-model="pointRadius"
                                v-model:raw="showPointRadius" label-width="8rem"
                                :label="`Point radius (${showPointRadius})`"
                                :min="3" :max="20" :step="1" />
        <v-btn @click="showSelect=true">Select</v-btn>
        <v-btn @click="resetSelected" :disabled="selectionMarkers.length === 0">Deselect</v-btn>
      </div>
      <div class="buttons-line mt-2 ml-2 mb-n5">
        <v-switch v-model="showLegend" label="Show legend" hide-details/>
        <v-btn v-focus @click="closeWindow('/scatter')" class="mr-2 mb-4">Close</v-btn>
      </div>
    </v-container>
  </div>

<v-dialog v-model="showSelect">
  <v-card title="Manage point selection" class="mx-auto no-select" elevation="16" width="380">
    <v-card-text class="pb-0">
      <v-row class="ga-2 mt-2 mb-5 ml-1" no-gutters>
        <v-btn @click="selectAll" :disabled="!scatterplotData?.points.length" class="equal">
          Select all
        </v-btn>
        <v-btn @click="resetSelected" :disabled="noSelectedPoints" class="equal">
          Deselect all
        </v-btn>
      </v-row>
      <v-divider thickness="2" />
      <g-slider-with-steppers v-model="selectedGroup" :disabled="!scatterplotData?.countGroups"
                              v-model:raw="showSelectedGroup" label-width="5rem"
                              :label="`Group (${showSelectedGroup})`" class="mt-2"
                              :min="0" :max="(scatterplotData?.countGroups || 1) - 1" :step="1" />
      <v-btn @click="selectByGroup" :disabled="!scatterplotData?.countGroups" class="w-75 mt-4 ml-1 mb-4">
        Select by group
      </v-btn>
      <v-divider thickness="2" />
      <v-btn @click="selectByGroupMinEnergy" :disabled="scatterplotData?.energies.length === 0" class="w-75 mt-4 ml-1 mb-4">
        Select by min energy
      </v-btn>
      <v-divider thickness="2" />
      <!-- <v-btn class="mt-4 mb-4 ml-1 w-75" @click="compareSelected" :disabled="noSelectedPoints"> -->
      <v-btn class="mt-4 mb-4 ml-1 w-75" @click="compareSelected" :disabled="true">
        Compare selected
      </v-btn>
      <v-divider thickness="2" />
      <v-btn class="mt-4 ml-1 w-75" @click="showSave=!showSave" :disabled="noSelectedPoints">
        Export selected
      </v-btn>

      <g-select-file v-if="showSave" class="mt-4" title="Select output file"
                     :filter="filterPOSCAR" kind="save" @selected="selectedSaveFile" />

    </v-card-text>
    <v-card-actions>
      <v-btn v-focus @click="showSelect=false">Close</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

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
  flex-direction: column;
  display: flex;
  max-width: 3000px !important;
  padding: 0 20px 16px 20px !important;
}

.buttons-line {
  justify-content: space-between;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  padding-right: 40px !important;
}

.equal {
  width: 158px;
}

.legend {
  position: absolute;
  bottom: 116px;
  right: 20px;
  z-index: 800;
  background-color: #7e7e7e46;
  width: 220px;
  height: 220px;
  overflow: hidden auto;
  padding-left: 7px;
  padding-top: 7px;
}

.narrow {
  width: 150px;
  height: 270px;
}

.tg td {overflow:hidden; padding:10px 5px;}
.tg .td-top {text-align:right;vertical-align:top}
.tg .td-bottom {text-align:right;vertical-align:bottom}

</style>
