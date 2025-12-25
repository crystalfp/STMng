<script setup lang="ts">
/**
 * @component
 * Show the energy surface resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-14
 */
import {ref, watch, computed} from "vue";
import {PlaneGeometry, MeshStandardMaterial,
        Float32BufferAttribute, Mesh, DoubleSide} from "three";
import {SimpleViewer} from "@/services/SimpleViewer";
import {Lut} from "three/addons/math/Lut.js";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {scatterToUniform} from "@/electron/fingerprint/ScatterToUniform";
import type {EnergyLandscapeData} from "@/types";

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

/** Initialize the 3D viewer */
const sv = new SimpleViewer(".landscape-viewer", true);

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    energyLandscapeData = JSON.parse(dataFromMain) as EnergyLandscapeData;

    const {points, energies} = energyLandscapeData;

    if(points.length === 0) return;

    // Interpolate the scatter points to a regular grid
    grid = scatterToUniform(gridSide.value,
                            points,
                            energies,
                            power.value);

    renderSurface();
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/fp-landscape");

watch([gridSide, power], () => {

    if(!energyLandscapeData) return;

    const {points, energies} = energyLandscapeData;

    // Interpolate the scatter points to a regular grid
    grid = scatterToUniform(gridSide.value,
                            points,
                            energies,
                            power.value);

    renderSurface();
});

watch(energyScale, () => {

    renderSurface();
});

watch(colormapName, () => {

    lut.setColorMap(colormapName.value, 256);
    renderSurface();
});

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

    // Fill coordinates values
    for(let i=0; i < pos.count; i++) {

        const z = (grid[i]-minValue)/(maxValue-minValue);
        pos.setZ(i, z*energyScale.value);
    }

    // Add colors to surface
    lut.setMax(maxValue);
    lut.setMin(minValue);

    const colors = Array<number>(pos.count*3).fill(0);
    for(let i=0; i < pos.count; i++) {

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

</script>


<template>
<v-app :theme>
  <Suspense>
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
      <v-btn v-focus class="mt-2 ee" @click="closeWindow('/fp-landscape')">Close</v-btn>
    </v-container>
  </div>
  </Suspense>
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
    "dd .  .  .  ee" 1fr / 0.5fr 0.5fr 1fr 0.7fr 0.3fr;
  max-width: 3000px !important;
  padding: 20px !important;
}

.aa { grid-area: aa; }

.bb { grid-area: bb; }

.cc { grid-area: cc; }

.dd { grid-area: dd; }

.ee { grid-area: ee; }

</style>
