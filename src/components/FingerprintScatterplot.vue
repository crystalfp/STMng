<script setup lang="ts">
/**
 * @component
 * Show the scatterplot resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-26
 */
import {computed, onMounted, ref, watch} from "vue";
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
let scatterplotX = 0;
let scatterplotY = 0;

/** The scatterplot type */
const scatterplotType = ref("group");

/** The scatterplot parameters */
const pointRadius = ref(5);
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

/** Distance threshold to remove duplicates in convex hull */
const threshold = ref(0.01);
const showThreshold = ref(0.01);

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
let maxDelta = 1;
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
    maxDelta = minDelta;
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

    overallQuality = 0;
    const n = efficiencies.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        let delta = efficiencies[i][1] - efficiencies[i][0];
        const value = delta;
        if(delta < 0) delta = -delta;
        overallQuality += delta;

        const color = lut ? `#${lut.getColor(maxDelta-delta).getHexString()}` : "#0000FF";

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
        else if(sl === 0)  color = "#00c0ff";
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

    const resizeObserver = new ResizeObserver((entries) => {

        for(const entry of entries) {
            if(entry.borderBoxSize) {
                scatterplotWidth.value = entry.borderBoxSize[0].inlineSize;
                scatterplotHeight.value = entry.borderBoxSize[0].blockSize;
            }
            else {
                scatterplotWidth.value = entry.contentRect.width;
                scatterplotHeight.value = entry.contentRect.height;
            }
        }
    });

    const canvas = document.querySelector<HTMLDivElement>(".side-n");
    if(!canvas) return;
    resizeObserver.observe(canvas);
    const rect = canvas.getClientRects()[0];
    scatterplotX = rect.x;
    scatterplotY = rect.y;
});

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    scatterplotData = JSON.parse(dataFromMain) as ScatterplotData;
    scatterplotDataAvailable.value = true;

    if(scatterplotData.convexHull.length > 0) {
        setTimeout(() => {
            selectedPoints.value.length = 0;
            for(const idx of scatterplotData!.convexHull) {
                if(!selectedPoints.value.includes(idx)) {
                    selectedPoints.value.push(idx);
                }
            }
        }, 100);
    }
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

    rectangleStartX = event.clientX - scatterplotX;
    rectangleStartY = event.clientY - scatterplotY;
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

    let rectangleEndX = event.clientX - scatterplotX;
    let rectangleEndY = event.clientY - scatterplotY;

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
    if(lastMoveEvent && (event.timeStamp - lastMoveEvent) < 50) return;
    lastMoveEvent = event.timeStamp;

    const rectangleEndX = event.clientX - scatterplotX;
    const rectangleEndY = event.clientY - scatterplotY;

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

/**
 * Select points that falls on a convex hull in 4D
 */
const selectByConvexHull4D = (): void => {

    sendToNode("SYSTEM", "convex-hull", {
        dimension: 4,
        threshold: threshold.value
    });
};

watch([threshold], selectByConvexHull4D);

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
            {key: 5, color: "#00c0ff", label: "Group of one element"},
            {key: 6, color: "white",   label: "Across groups border"},
        ];
    }

    return [];
});

// Create the color scale for the legend
const lut2 = new Lut("blackbody", 128);
const colorScale = lut2.createCanvas().toDataURL();

const legendContinue = computed(() => {

    switch (scatterplotType.value) {
    case "energy":
        return {
            min: minEnergy.toFixed(4),
            max: maxEnergy.toFixed(4),
            header: "Energy",
            footer: ""
        };
    case "efficiency":
        return {
            min: (maxDelta*Math.SQRT1_2).toFixed(4),
            max: "0.0000",
            header: "Distance from diagonal",
            footer: `Mean: ${(overallQuality*Math.SQRT1_2).toFixed(3)}`
        };
    default:
        return {
            min: "0.0000",
            max: "1.0000",
            header: "",
            footer: ""
        };
    }
});
// > Start template
</script>


<template>
<v-app :theme="theme">
  <div class="scatterplot-grid">
    <div class="side-w pa-2 mr-2">
      <v-label class="separator-title mt-1" style="border: none">Manage selection</v-label>

      <v-row class="ga-3 mt-2 mb-5 ml-1">
        <v-btn @click="selectAll" :disabled="!scatterplotData?.points.length" class="equal">
          Select all
        </v-btn>
        <v-btn @click="resetSelected" :disabled="noSelectedPoints" class="equal">
          Deselect all
        </v-btn>
      </v-row>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <g-slider-with-steppers v-model="selectedGroup" :disabled="!scatterplotData?.countGroups"
                              v-model:raw="showSelectedGroup" label-width="7rem"
                              :label="`Group (${showSelectedGroup})`" class="mt-2"
                              :min="0" :max="(scatterplotData?.countGroups || 1) - 1" :step="1" />
      <v-btn @click="selectByGroup" :disabled="!scatterplotData?.countGroups"
             block class="mt-4 ml-1 mb-4">
        Select group
      </v-btn>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <v-btn @click="selectByGroupMinEnergy" :disabled="!scatterplotData?.energies.length"
             block class="mt-4 ml-1 mb-4">
        Min energy per group
      </v-btn>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <v-btn @click="selectByConvexHull4D" :disabled="!scatterplotData?.energies.length"
             block class="mt-4 ml-1 mb-2">
        Generalized convex hull
      </v-btn>
      <g-slider-with-steppers v-model="threshold" :disabled="!scatterplotData?.energies.length"
                              v-model:raw="showThreshold" label-width="9rem"
                              :label="`Threshold (${showThreshold.toFixed(3)})`" class="mb-2"
                              :min="0" :max="0.5" :step="0.001" />
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <!-- <v-btn class="mt-4 mb-4 ml-1 w-75" @click="compareSelected" :disabled="noSelectedPoints"> -->
      <v-btn @click="compareSelected" :disabled="true" block class="mt-4 mb-4 ml-1">
        Compare selected
      </v-btn>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <v-btn @click="showSave = !showSave" :disabled="noSelectedPoints" block class="mt-4 ml-1">
        Export selected
      </v-btn>

      <g-select-file v-if="showSave" class="mt-4" title="Select output file"
                     :filter="filterPOSCAR" kind="save" @selected="selectedSaveFile" />
    </div>

    <div class="side-n">
      <!-- <svg :width="scatterplotWidth" :height="scatterplotHeight" x="0" y="0"
          :viewBox="`0 0 ${scatterplotWidth} ${scatterplotHeight}`" fill="transparent"
          xmlns="http://www.w3.org/2000/svg" @click="textShow=false"
          @mousedown="mousedown" @mouseup="mouseup" @mousemove="mousemove"> -->
      <svg width="100%" height="100%" x="0" y="0" fill="transparent"
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

    <div class="side-s scatterplot-buttons">
      <div class="buttons-line">
        <v-btn-toggle v-model="scatterplotType" mandatory>
          <v-btn value="group">Group</v-btn>
          <v-btn value="energy" :disabled="!scatterplotData?.energies.length">Energy</v-btn>
          <v-btn value="efficiency">Fidelity</v-btn>
          <v-btn value="silhouette">Quality</v-btn>
        </v-btn-toggle>
        <g-slider-with-steppers v-model="pointRadius"
                                v-model:raw="showPointRadius" label-width="9rem"
                                :label="`Point radius (${showPointRadius})`"
                                :min="3" :max="20" :step="1" />
        <v-btn @click="resetSelected" :disabled="selectionMarkers.length === 0">Deselect</v-btn>
      </div>
      <div class="buttons-line mt-2 ml-2 mb-n4">
        <v-switch v-model="showLegend" label="Show legend" hide-details/>
        <v-btn v-focus @click="closeWindow('/scatter')" class="mr-2 mb-4">Close</v-btn>
      </div>
    </div>
  </div>
</v-app>
</template>


<style scoped>

.scatterplot-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  grid-template-rows: 1fr 120px;
  gap: 0 0;
  grid-auto-flow: row;
  grid-template-areas:
    "aa bb"
    "aa cc";
  height: 100vh;
}

.side-w {grid-area: aa;}

.side-n {grid-area: bb;}

.side-s {grid-area: cc;}

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
  padding: 10px 0 16px 0 !important;
  margin-bottom: 10px;
}

.buttons-line {
  justify-content: space-between;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  gap: 10px;
  padding-right: 20px !important;
  padding-left: 20px !important;
  width: 100%
}

.equal {
  width: 158px;
}

.legend {
  position: absolute;
  bottom: 141px;
  right: 21px;
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
