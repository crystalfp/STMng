<script setup lang="ts">
/**
 * @component
 * Show the scatterplot resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-26
 */
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from "vue";
import log from "electron-log";
import {Lut} from "three/addons/math/Lut.js";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {askNode, closeWindow, requestData, sendToNode} from "@/services/RoutesClient";
import {theme} from "@/services/ReceiveTheme";
import {contrastingColors} from "@/electron/fingerprint/ContrastingColors";
import {KDTree} from "@/electron/fingerprint/KDtree.js";
import type {CtrlParams, ScatterplotData} from "@/types";

import SelectFile from "@/widgets/SelectFile.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import ViewerLegend from "@/widgets/ViewerLegend.vue";

/**
 * One point that goes to the scatterplot
 * @notExported
 */
interface Glyph {

    /** The original step number or sequence number for fidelity display */
    id: number;

    /** X point coordinate (range 0..1) */
    px: number;

    /** Y point coordinate (range 0..1) */
    py: number;

    /** The color of the point as "#RRGGBB" */
    color: string;

    /** Value associated to the point: group, energy, or delta for fidelity */
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
const showPointRadius = ref(5);
const fgColor = "#575757";
const noValueColor = "#4359FF";
const colormapName = computed(() => (theme.value === "dark" ? "blackbody" : "rainbow"));
const COLORMAP_LENGTH = 128;

/** The received data */
const scatterplotData = ref<ScatterplotData | undefined>();

/** The group colors */
let groupColors: string[] = [];

/** The energy range */
let minEnergy = 0;
let maxEnergy = 0;

/** Indices of the selected points */
const selectedPoints = reactive(new Set<number>());
const noSelectedPoints = computed(() => selectedPoints.size === 0);

/** Reference to the canvas element */
let canvas: HTMLCanvasElement | null;

const errorMessage = ref("");
const successMessage = ref("");

/**
 * Convert point coordinates into screen coordinates
 *
 * @param px - Point x coordinates (range 0..1)
 * @param py - Point y coordinates (range 0..1)
 * @returns The corresponding screen coordinates for the canvas
 */
const pointToScreen = (px: number, py: number): {sx: number; sy: number} => ({
    sx: Math.round(px * (scatterplotWidth.value - 20)),
    sy: Math.round((1-py) * (scatterplotHeight.value - 40))
});

/**
 * Convert screen coordinates into point coordinates
 *
 * @param px - Screen x coordinates
 * @param py - Screen y coordinates
 * @returns The corresponding point coordinates clamped to 0..1
 */
const screenToPoint = (sx: number, sy: number): {px: number; py: number} => {

    let px = sx/(scatterplotWidth.value - 20);
    let py = 1-(sy/(scatterplotHeight.value - 40));

    if(px < 0) px = 0;
    else if(px > 1) px = 1;
    if(py < 0) py = 0;
    else if(py > 1) py = 1;

    return {px, py};
};

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

    if(!scatterplotData.value || scatterplotData.value.points.length === 0) return [];

    const noGroups = scatterplotData.value.countGroups === 0;
    if(!noGroups) {
        // Prepare the list of contrasting colors
        const backgroundColor: [number, number, number] =
                    (theme.value === "dark") ? [0.07059, 0.07059, 0.07059] : [1, 1, 1];
        const colorsRaw = contrastingColors(scatterplotData.value.countGroups, backgroundColor);
        groupColors = colorsToRGB(colorsRaw);
    }

    // Map each point to a glyph
    const {points, values, id} = scatterplotData.value;
    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        // Get the color corresponding to the group of the point
        const color = noGroups ? noValueColor : groupColors[values[i]];

        out.push({
            id: id[i],
            px: points[i][0],
            py: points[i][1],
            color,
            value: noGroups ? 0 : values[i],
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

    if(!scatterplotData.value || scatterplotData.value.points.length === 0) return [];

    // Map each point to a glyph
    const {points, values, id} = scatterplotData.value;

    // Extract the energy range
    minEnergy = values[0];
    maxEnergy = minEnergy;
    const len = values.length;
    for(let i=1; i < len; ++i) {
        if(values[i] < minEnergy) minEnergy = values[i];
        if(values[i] > maxEnergy) maxEnergy = values[i];
    }

    // Generate the colormap
    const lut = (maxEnergy - minEnergy) < 1e-10 ?
                                    undefined :
                                    new Lut(colormapName.value, COLORMAP_LENGTH);
    if(lut) {
        lut.setMin(minEnergy);
        lut.setMax(maxEnergy);
    }

    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        const color = lut ? `#${lut.getColor(values[i]).getHexString()}` : noValueColor;

        out.push({
            id: id[i],
            px: points[i][0],
            py: points[i][1],
            color,
            value: values[i],
        });
    }
    return out;
};

let overallQuality = 0;
let maxDelta = 1;
/**
 * Return the points for the scatterplot colored by fidelity
 * - X axis is the original distance
 * - Y axis is the distance after the projection
 *
 * @returns The list of points as glyphs
 */
const pointsByEfficiency = (): Glyph[] => {

    if(!scatterplotData.value || scatterplotData.value.fidelity.length === 0) return [];

    // Map each point to a glyph
    const {fidelity} = scatterplotData.value;

    // Extract the distance from the diagonal
    let minDelta = fidelity[0][1] - fidelity[0][0];
    maxDelta = minDelta;
    const len = fidelity.length;
    for(let i=1; i < len; ++i) {
        const delta = fidelity[i][1] - fidelity[i][0];
        if(delta < minDelta) minDelta = delta;
        if(delta > maxDelta) maxDelta = delta;
    }
    if(minDelta < 0) minDelta = -minDelta;
    if(maxDelta < 0) maxDelta = -maxDelta;
    maxDelta = Math.max(maxDelta, minDelta);

    // Generate the colormap
    const lut = maxDelta < 1e-10 ?
                        undefined : new Lut(colormapName.value, COLORMAP_LENGTH);
    if(lut) {
        lut.setMin(0);
        lut.setMax(maxDelta);
    }

    overallQuality = 0;
    const n = fidelity.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        let delta = fidelity[i][1] - fidelity[i][0];
        const value = delta;
        if(delta < 0) delta = -delta;
        overallQuality += delta;

        const color = lut ? `#${lut.getColor(maxDelta-delta).getHexString()}` : noValueColor;

        out.push({
            id: i,
            px: fidelity[i][0],
            py: fidelity[i][1],
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

    if(!scatterplotData.value || scatterplotData.value.values.length === 0) return [];

    // Map each point to a glyph
    const {points, values, id} = scatterplotData.value;
    const n = points.length;
    const out: Glyph[] = [];
    for(let i=0; i < n; ++i) {

        // Get the color corresponding to the silhouette coefficient of the point
        const sl = values[i];

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
            px: points[i][0],
            py: points[i][1],
            color,
            value: sl
        });
    }
    return out;
};

/** The info associated to the clicked point */
const textShow = ref(false);
let textX = 0;
let textY = 0;
let textLine1 = "";
let textLine2 = "";

/** Rectangular point selection (with right mouse button) */
const x = ref(0);
const y = ref(0);
const width = ref(0);
const height = ref(0);
let rectangleStartX: number | undefined;
let rectangleStartY: number | undefined;
const showSelectionRectangle = ref(false);

let glyphs: Glyph[] = [];
let tree: KDTree;

/**
 * Draw points on the canvas
 */
const drawPoints = (): void => {

    // Access the canvas context
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    if(!ctx) return;

    // Compute the points
    switch(scatterplotType.value) {
        case "energy":
            glyphs = pointsByEnergy();
            break;
        case "fidelity":
            glyphs = pointsByEfficiency();
            break;
        case "group":
            glyphs = pointsByGroup();
            break;
        case "silhouette":
            glyphs = pointsBySilhouettes();
            break;
        default:
            glyphs = [];
            break;
    }

    // Clean the canvas and exit if no points
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(glyphs.length === 0) return;

    // Draw the points
    for(const glyph of glyphs) {

        const {sx, sy} = pointToScreen(glyph.px, glyph.py);
        ctx.beginPath();
        ctx.arc(sx, sy, pointRadius.value, 0, 2 * Math.PI, false);
        ctx.fillStyle = glyph.color;
        ctx.fill();
    }

    // If the plot is about fidelity, draw the optimal diagonal
    if(scatterplotType.value === "fidelity") {

        ctx.beginPath();
        const {sx: startX, sy: startY} = pointToScreen(0, 0);
        ctx.moveTo(startX, startY);
        const {sx: endX, sy: endY} = pointToScreen(1, 1);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    else {

        // Draw marker for points selected
        for(const idx of selectedPoints) {

            const glyph = glyphs[idx];
            const {sx, sy} = pointToScreen(glyph.px, glyph.py);
            ctx.beginPath();
            ctx.arc(sx, sy, pointRadius.value+5, 0, 2 * Math.PI, false);
            ctx.strokeStyle = glyph.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    // Add text if requested
    if(textShow.value) {
        ctx.font = "20px sans-serif";
        ctx.fillStyle = fgColor;

        ctx.fillText(textLine1, textX, textY);
        ctx.fillText(textLine2, textX, textY+22);
    }

    // Manage the selection rectangle
    if(showSelectionRectangle.value) {
        ctx.beginPath();
        ctx.rect(x.value, y.value, width.value, height.value);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Prepare the KD-tree to select clicked points
    if(glyphs.length > 0) tree = new KDTree(glyphs, ["px", "py"]);
};

/**
 * When a point has been selected by clicking
 *
 * @param event - To obtain the click coordinates
 */
const pointClicked = (event: MouseEvent): void => {

    // Do not allow selection of points in fidelity mode
    if(scatterplotType.value === "fidelity") return;

    // Convert click coordinates into point coordinates
    let xx = (event.clientX - scatterplotX)/(scatterplotWidth.value-20);
    let yy = (scatterplotHeight.value-(event.clientY+20))/(scatterplotHeight.value-40);
    if(xx < 0) xx = 0;
    else if(xx > 1) xx = 1;
    if(yy < 0) yy = 0;
    else if(yy > 1) yy = 1;

    // Find the nearest point index
    const nearestNeighbor = tree.nearest({px: xx, py: yy});

    let r2 = (2*pointRadius.value)/(scatterplotWidth.value - 20);
    r2 *= r2;

    if(nearestNeighbor.squared_distance > r2) {
        textShow.value = false;
        return;
    }

    const idx = nearestNeighbor.point.idx;

    // If the point is already selected, remove it; otherwise add it
    if(selectedPoints.has(idx)) {
        selectedPoints.delete(idx);
        textShow.value = false;
        return;
    }
    selectedPoints.add(idx);

    // Prepare the text to show and move it to remain inside the plot
    const {id, px, py, value} = glyphs[idx];
    let valueLine = "";
    switch(scatterplotType.value) {
        case "group":       valueLine = `Group: ${value}`; break;
        case "energy":      valueLine = `Energy: ${value.toFixed(4)}`; break;
        case "silhouette":  valueLine = `Quality: ${value.toFixed(2)}`; break;
    }

    const {sx, sy} = pointToScreen(px, py);
    textX = sx > scatterplotWidth.value - 150 ? sx-110 : sx+pointRadius.value+10;
    textY = sy > scatterplotHeight.value - 100 ? sy-32 : sy+6;
    if(sy < 30) textY = sy + 15;
    textLine1 = `Step: ${id}`;
    textLine2 = valueLine;
    textShow.value = true;
};

// Redraw canvas if parameters change
watch([
    pointRadius, scatterplotType, selectedPoints, textShow,
    x, y, width, height, showSelectionRectangle
], drawPoints, {deep: true});

let resizeObserver: ResizeObserver;

onMounted(() => {

    resizeObserver = new ResizeObserver((entries) => {

        for(const entry of entries) {
            scatterplotWidth.value = entry.borderBoxSize[0].inlineSize;
            scatterplotHeight.value = entry.borderBoxSize[0].blockSize;
        }
        setTimeout(drawPoints, 100);
    });

    const canvasContainer = document.querySelector<HTMLDivElement>(".side-n");
    if(!canvasContainer) return;
    resizeObserver.observe(canvasContainer);
    const rect = canvasContainer.getClientRects()[0];
    scatterplotX = rect.x;
    scatterplotY = rect.y;

    setTimeout(drawPoints, 100);

    // Setup the click handler
    canvas = document.querySelector<HTMLCanvasElement>(".side-n canvas");
    if(canvas) canvas.addEventListener("click", pointClicked);
});

onBeforeUnmount(() => {

    resizeObserver.disconnect();

    if(canvas) canvas.removeEventListener("click", pointClicked);
});

// Request the data for a given plot
watch(scatterplotType, () => {

    textShow.value = false;
    sendToNode("SYSTEM", "selected-plot", {
        plotType: scatterplotType.value,
    });
});

const windowPath = "/fp-scatterplot";

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    scatterplotData.value = JSON.parse(params.scatterplot as string) as ScatterplotData;

    if(scatterplotData.value.selectedPoints !== undefined) {
        selectedPoints.clear();
        for(const pt of scatterplotData.value.selectedPoints) selectedPoints.add(pt);
    }

    drawPoints();
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Select all points
 */
const selectAll = (): void => {

    errorMessage.value = "";
    successMessage.value = "";

    if(!scatterplotData) return;

    const cnt = scatterplotData.value?.points.length;
    if(!cnt) return;

    selectedPoints.clear();
    for(let i=0; i < cnt; ++i) selectedPoints.add(i);
};

/**
 * Reset the selected points
 */
const resetSelected = (): void => {

    errorMessage.value = "";
    successMessage.value = "";

    selectedPoints.clear();
    textShow.value = false;
};

/** Selected all points pertaining to a group */
const selectedGroup = ref(0);
const showSelectedGroup = ref(0);

/**
 * Selected all points pertaining to a group
 */
const selectByGroup = (): void => {

    errorMessage.value = "";
    successMessage.value = "";

    if(!scatterplotData.value ||
        scatterplotData.value.countGroups === 0) return;

    const cnt = scatterplotData.value.values.length;
    if(!cnt) return;

    for(let i=0; i < cnt; ++i) {
        if(scatterplotData.value.values[i] === selectedGroup.value) {
            selectedPoints.add(i);
        }
    }
};

/**
 * Select the point by the given criteria
 */
const selectByCriteria = (criteria: string): void => {

    errorMessage.value = "";
    successMessage.value = "";

    askNode("SYSTEM", "get-selections", {
        criteria
    })
    .then((params: CtrlParams) => {

        const selection = params.selectedPoints as number[] ?? [];
        if(selection.length > 0) {
            for(const idx of selection) selectedPoints.add(idx);
            drawPoints();
        }
    })
    .catch((error: Error) => {
        const message = `Error from getting selected points for "${criteria}":`;
        log.error(message, error.message);
        errorMessage.value = message;
    });
};

// > Save selected to the selected file name
const showSave = ref(false);
const saveEnergyPerAtom = ref(false);

/**
 * Save selected structures to the chosen file name
 *
 * @param filename - Selected filename
 */
const selectedSaveFile = (filename: string): void => {

    if(filename) {

        // selectedPoints contains the index of the on-screen glyph,
        // so it should be converted into the step value
        const selectedSteps: number[] = [];
        for(const idx of selectedPoints) {
            selectedSteps.push(glyphs[idx].id);
        }

        askNode("SYSTEM", "selected-points", {
            filename,
            selectedSteps,
            saveEnergyPerAtom: saveEnergyPerAtom.value
        })
        .then((status: CtrlParams) => {

            if(status.error) throw Error(status.error as string);
            const energy = status.energyPath as string ? ` and ${status.energyPath as string}` : "";
            successMessage.value = `Saved ${status.structurePath as string}${energy}`;
        })
        .catch((error: Error) => {
            errorMessage.value = `Error from saving selected points ${error.message}`;
        });
    }
    showSave.value = false;
};

const filterPOSCAR = '[{"name":"POSCAR","extensions":["poscar"]},{"name":"All","extensions":["*"]}]';

/**
 * Compare structures selected
 */
const compareSelected = (): void => {

    errorMessage.value = "";
    successMessage.value = "";

    if(selectedPoints.size < 2) return;

    sendToNode("SYSTEM", "compare", {selectedPoints: [...selectedPoints]});
};

/** Setup the legend */
const showLegend = ref(false);
const showLegendDiscrete = computed(() => showLegend.value &&
                                          (scatterplotType.value === "group" ||
                                           scatterplotType.value === "silhouette"));
const showLegendContinue = computed(() => showLegend.value &&
                                          (scatterplotType.value === "energy" ||
                                           scatterplotType.value === "fidelity"));

const legendDiscrete = computed<{key: number; color: string; label: string}[]>(() => {

    if(scatterplotType.value === "group") {
        if(!scatterplotData.value || scatterplotData.value.countGroups === 0) {
            return [{key: 0, color: noValueColor, label: "No groups"}];
        }
        const out = [];
        let group = 0;
        for(const color of groupColors) {
            out.push({key: group, color, label: `Group ${group}`});
            ++group;
        }
        return out;
    }
    if(scatterplotType.value === "silhouette") {
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


const legendContinue = computed(() => {

    switch(scatterplotType.value) {
    case "energy":
        return {
            min: minEnergy.toFixed(4),
            max: maxEnergy.toFixed(4),
            header: "Energy by atom",
            footer: ""
        };
    case "fidelity":
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

// > Mouse rectangular selection
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

    // Transform into point coordinates
    let {px: startX, py: startY} = screenToPoint(rectangleStartX, rectangleStartY);
    let {px: endX,   py: endY}   = screenToPoint(rectangleEndX, rectangleEndY);
    if(startX > endX) [startX, endX] = [endX, startX];
    if(startY > endY) [startY, endY] = [endY, startY];

    let idx = 0;
    textShow.value = false;
    if(event.ctrlKey) {

        for(const glyph of glyphs) {
            if(glyph.px >= startX && glyph.px <= endX &&
               glyph.py >= startY && glyph.py <= endY) {
                selectedPoints.delete(idx);
            }
            ++idx;
        }
    }
    else {

        for(const glyph of glyphs) {

            if(glyph.px >= startX && glyph.px <= endX &&
               glyph.py >= startY && glyph.py <= endY) {
                selectedPoints.add(idx);
            }
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

const vc = computed(() => {
    return {
        min: legendContinue.value.min,
        max: legendContinue.value.max,
        footer: legendContinue.value.footer,
        colormap: colormapName.value
    };
});


// > Start template
</script>


<template>
<v-app :theme>
  <div class="scatterplot-grid">
    <div class="side-w pa-2 mr-2">
      <v-label class="separator-title first-title">Manage selection</v-label>

      <v-row class="ga-3 mt-2 mb-5 ml-1 mr-n1 two-buttons">
        <v-btn :disabled="!scatterplotData?.points.length" class="left" @click="selectAll">
          Select all
        </v-btn>
        <v-btn :disabled="noSelectedPoints" class="right" @click="resetSelected">
          Deselect all
        </v-btn>
      </v-row>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <slider-with-steppers v-model="selectedGroup" v-model:raw="showSelectedGroup"
                              :disabled="!scatterplotData?.countGroups" label-width="7rem"
                              :label="`Group (${showSelectedGroup})`" class="mt-2"
                              :min="0" :max="(scatterplotData?.countGroups || 1) - 1" :step="1" />
      <v-btn :disabled="!scatterplotData?.countGroups"
             block class="mt-4 ml-1 mb-4" @click="selectByGroup">
        Select group
      </v-btn>
      <v-btn :disabled="!scatterplotData?.hasEnergies"
             block class="mt-4 ml-1 mb-4" @click="selectByCriteria('min-energy')">
        Min energy per group
      </v-btn>
      <v-btn :disabled="!scatterplotData?.hasEnergies"
             block class="mt-4 ml-1 mb-4" @click="selectByCriteria('convex-hull')">
        Gen. convex hull
      </v-btn>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <v-btn block class="mt-4 mb-4 ml-1" :disabled="selectedPoints.size < 2"
             @click="compareSelected">
        Compare selected
      </v-btn>
      <v-divider thickness="2" class="mr-n1 ml-1"/>
      <v-btn :disabled="noSelectedPoints" block class="mt-4 ml-1" @click="showSave = !showSave">
        Export selected
      </v-btn>

      <select-file v-if="showSave" class="mt-4" title="Select output file"
                     :filter="filterPOSCAR" kind="save" @selected="selectedSaveFile" />
      <v-switch v-if="showSave && scatterplotData?.hasEnergies" v-model="saveEnergyPerAtom"
                class="ml-4 mt-2" label="Save energy per atom"/>

      <v-alert v-if="errorMessage !== ''" title="Error" class="mt-4 ml-1 cursor-pointer"
         :text="errorMessage" type="error" density="compact"
         color="red" @click="errorMessage=''" />
      <v-alert v-if="successMessage !== ''" title="Success!" :text="successMessage"
        type="success" density="compact" class="mt-4 ml-1 cursor-pointer" @click="successMessage=''"/>
    </div>

    <div class="side-n">
      <canvas :width="scatterplotWidth-20" :height="scatterplotHeight-40"
              :style="{border: `2px solid ${fgColor}`}"
              @mousedown="mousedown" @mouseup="mouseup" @mousemove="mousemove" />

      <viewer-legend v-if="showLegendDiscrete"
                     :width="220" :height="220" :bottom="145" :right="25"
                     :values-discrete="legendDiscrete"/>
      <viewer-legend v-else-if="showLegendContinue"
                     :width="150" :height="285" :bottom="145" :right="25"
                     :title="legendContinue.header"
                     :values-continue="vc"/>
    </div>

    <div class="side-s scatterplot-buttons">
      <div class="buttons-line">
        <v-btn-toggle v-model="scatterplotType" mandatory>
          <v-btn value="group">Group</v-btn>
          <v-btn value="energy" :disabled="!scatterplotData?.hasEnergies">Energy</v-btn>
          <v-btn value="fidelity">Fidelity</v-btn>
          <v-btn value="silhouette" :disabled="scatterplotData?.countGroups === 0">Quality</v-btn>
        </v-btn-toggle>
        <slider-with-steppers v-model="pointRadius"
                                v-model:raw="showPointRadius" label-width="9rem"
                                :label="`Point radius (${showPointRadius})`"
                                :min="3" :max="20" :step="1" />
        <v-btn :disabled="selectedPoints.size === 0" @click="resetSelected">Deselect</v-btn>
      </div>
      <div class="buttons-line mt-2 ml-2 mb-n4">
        <v-switch v-model="showLegend" label="Show legend"/>
        <v-btn v-focus class="mr-2 mb-4" @click="closeWindow(windowPath)">Close</v-btn>
      </div>
    </div>
  </div>
</v-app>
</template>


<style scoped>

.scatterplot-grid {
  display: grid;
  gap: 0;
  grid-auto-flow: row;
  grid-template:
    "aa bb" 1fr
    "aa cc" 120px / 360px 1fr;
  height: 100vh;
}

.side-w {grid-area: aa;}

.side-n {grid-area: bb; padding-top: 20px}

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
  width: 100%
}

.legend {
  position: absolute;
  bottom: 138px;
  right: 18px;
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

.two-buttons {
  display: grid;
  gap: 0 10px;
  grid-auto-flow: row;
  grid-template:
    "aa bb" 1fr / 1fr 1fr;
}

.left { grid-area: aa; }

.right { grid-area: bb; }

</style>
