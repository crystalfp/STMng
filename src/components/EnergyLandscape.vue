<script setup lang="ts">
/**
 * @component
 * Show the energy surface resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-14
 */
import {ref, watch, computed} from "vue";
import {PlaneGeometry, MeshStandardMaterial, Material,
        Float32BufferAttribute, Mesh, DoubleSide,
        BufferGeometry,
        PointsMaterial,
        Points} from "three";
import {SimpleViewer} from "@/services/SimpleViewer";
import {Lut} from "three/addons/math/Lut.js";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {scatterToUniform} from "@/electron/fingerprint/ScatterToUniform";
import type {CtrlParams, EnergyLandscapeData} from "@/types";

import SelectColormap from "@/widgets/SelectColormap.vue";
import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

/** The received data */
let energyLandscapeData: EnergyLandscapeData | undefined;

/** The interpolated grid */
let grid: number[] = [];

/** Vertical scale for the surface */
const energyScale = ref(1);
const showEnergyScale = ref(1);

/** Grid side as 2^gridSideExp */
const gridSideExp = ref(7);
const showGridSideExp = ref(7);
const gridSide = computed(() => 2**gridSideExp.value);

/** Power parameter for the interpolator */
const power = ref(2);
const showPower = ref(2);

/** Graphical variables */
const surfaceName = "Landscape";

/** Colormap */
const colormapName = ref("blackbody");
const lut = new Lut("blackbody", 256);

/** Show fingerprints as points */
const showPoints = ref(false);
const pointsName = "Landscape-points";

const windowPath = "/fp-landscape";

/** Initialize the 3D viewer */
const sv = new SimpleViewer(".landscape-viewer", true);

/** Receive the chart data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    energyLandscapeData = JSON.parse(params.landscape as string) as EnergyLandscapeData;

    const {points, energies} = energyLandscapeData;

    if(points.length === 0) return;

    // Interpolate the scatter points to a regular grid
    grid = scatterToUniform(gridSide.value,
                            points,
                            energies,
                            power.value);

    renderPoints();
    renderSurface();
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

watch([gridSide, power], () => {

    if(!energyLandscapeData) return;

    const {points, energies} = energyLandscapeData;

    // Interpolate the scatter points to a regular grid
    grid = scatterToUniform(gridSide.value,
                            points,
                            energies,
                            power.value);

    // renderPoints();
    renderSurface();
});

watch(energyScale, () => {

    renderPoints();
    renderSurface();
});

watch(colormapName, () => {

    lut.setColorMap(colormapName.value, 256);
    renderPoints();
    renderSurface();
});

watch(showPoints, () => {

    renderPoints();
});

/**
 * Create the surface
 */
const renderSurface = (): void => {

    // The grid side
    const side = gridSide.value;

    // Find z range
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    for(const z of grid) {

        if(z > maxValue) maxValue = z;
        if(z < minValue) minValue = z;
    }

    // Remove existing surface
    const scene = sv.getScene();
    const mesh = scene.getObjectByName(surfaceName) as Mesh;
    if(mesh) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.removeFromParent();
    }

    // Create geometry
    const geometry = new PlaneGeometry(1, 1, side-1, side-1);
    const pos = geometry.getAttribute("position");
    const posCount = pos.count;

    // Fill coordinates values
    for(let i=0; i < posCount; i++) {

        const z = (grid[i]-minValue)/(maxValue-minValue);
        pos.setZ(i, z*energyScale.value);
    }

    // Add colors to surface
    lut.setMax(maxValue);
    lut.setMin(minValue);

    const colors = Array<number>(posCount*3).fill(0);
    for(let i=0; i < posCount; i++) {

        const z = grid[i];
        const color = lut.getColor(z);

        colors[i*3]   = color.r;
        colors[i*3+1] = color.g;
        colors[i*3+2] = color.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    geometry.computeVertexNormals();

    // Define material
    const material = new MeshStandardMaterial({
        side: DoubleSide,
        roughness: 0.5,
        metalness: 0.6,
        vertexColors: true
    });

    // Move the camera to have the surface at the center of the viewer
    sv.centerCamera([0, 0.5, 0], 0.3);

    // Create surface
    const surface = new Mesh(geometry, material);
    surface.rotation.x = -Math.PI/2;
    surface.name = surfaceName;
    scene.add(surface);
    sv.setSceneModified();
};

const pointColor = new Map([
    ["blackbody",  0x00FF00],
    ["grayscale",  0xFFFF00],
    ["rainbow",    0xFFFF00],
    ["cooltowarm", 0x0000FF]
]);

/**
 * Create the points
 */
const renderPoints = (): void => {

    const scene = sv.getScene();
    const object = scene.getObjectByName(pointsName) as Mesh;
    if(object) {
        scene.remove(object);
        if(object.geometry) object.geometry.dispose();
        (object.material as Material).dispose();
        sv.setSceneModified();
    }

    if(!showPoints.value || !energyLandscapeData) return;

    const POINT_SIZE = 0.01;
    const {points: points2D, energies} = energyLandscapeData;
    const energiesLength = energies.length;

    const points3D: number[] = [];
    for(let i=0; i < energiesLength; ++i) {
        points3D.push(points2D[i][0]-0.5-POINT_SIZE,
                      0.5-points2D[i][1]-POINT_SIZE,
                      energies[i]*energyScale.value);
    }

    const color = pointColor.get(colormapName.value) ?? 0xFF0000;
    const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(points3D, 3));
    const material = new PointsMaterial({size: POINT_SIZE, color});
    const points = new Points(geometry, material);
    points.rotation.x = -Math.PI/2;
    points.name = pointsName;
    scene.add(points);
    sv.setSceneModified();
};

</script>


<template>
<v-app :theme>
  <div class="landscape-portal">
    <div class="landscape-viewer" />
    <v-container class="landscape-buttons">
      <slider-with-steppers v-model="energyScale" v-model:raw="showEnergyScale"
                              class="mb-2 aa" label-width="4.9rem"
                              :label="`Scale (${showEnergyScale})`"
                              :min="0" :max="2" :step="0.1" />
      <slider-with-steppers v-model="gridSideExp" v-model:raw="showGridSideExp"
                              class="mb-2 bb" label-width="7.5rem"
                              :label="`Grid side (${2**showGridSideExp})`"
                              :min="6" :max="11" :step="1" />
      <slider-with-steppers v-model="power" v-model:raw="showPower"
                              class="mb-2 mr-0 cc" label-width="5.5rem"
                              :label="`Power (${showPower})`"
                              :min="1" :max="6" :step="0.1" />
      <select-colormap v-model="colormapName" class="dd" />
      <v-btn v-focus class="mt-2 ee" @click="closeWindow(windowPath)">Close</v-btn>
      <v-switch v-model="showPoints" class="ml-4 ff" label="Show points" />
    </v-container>
  </div>
</v-app>
</template>


<style scoped>

.landscape-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 1100px;
  padding: 0;
}

.landscape-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}

.landscape-buttons {
  display: grid;
  gap: 5px 10px;
  grid-auto-flow: row;
  grid-template:
    "aa aa bb cc cc" 1fr
    "dd .  ff .  ee" 1fr / 0.5fr 0.5fr 1fr 0.7fr 0.3fr;
  max-width: 3000px !important;
  padding: 20px !important;
}

.aa { grid-area: aa; }

.bb { grid-area: bb; }

.cc { grid-area: cc; }

.dd { grid-area: dd; }

.ee { grid-area: ee; }

.ff { grid-area: ff; }

</style>
