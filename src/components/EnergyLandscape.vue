<script setup lang="ts">
/**
 * @component
 * Show the energy surface resulting from fingerprint computation.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-14
 */
import {onMounted, ref, watch, computed, useTemplateRef} from "vue";
import {theme} from "@/services/ReceiveTheme";
import {closeWithEscape} from "@/services/CaptureEscape";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {scatterToUniform} from "@/electron/fingerprint/ScatterToUniform";
import {Scene, Color, PerspectiveCamera, WebGLRenderer, DirectionalLight,
        PlaneGeometry, MeshStandardMaterial, AmbientLight,
        Float32BufferAttribute, Mesh, DoubleSide} from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {Lut} from "three/addons/math/Lut.js";
import type {EnergyLandscapeData} from "@/types";

/** The canvas sizes (will be computed during mount or resize) */
const canvasWidth = ref(500);
const canvasHeight = ref(300);

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

/** Reference to the view */
const cnv = useTemplateRef<HTMLElement>("view");

/** Graphical variables */
let scene: Scene;
let camera: PerspectiveCamera;
let renderer: WebGLRenderer;
const surfaceName = "Landscape";

/** Colormap */
const colormapName = ref("blackbody");
const lut = new Lut("blackbody", 256);

const initViewer = (): void => {

    if(!cnv.value) {
        return;
    }

    scene = new Scene();
    scene.background = new Color("#90CEEC");

    camera = new PerspectiveCamera(30, canvasWidth.value/canvasHeight.value);
    camera.position.set(5, 3, 5);
    camera.lookAt(scene.position);

    renderer = new WebGLRenderer({antialias: true});
    renderer.setSize(canvasWidth.value, canvasHeight.value);
    document.body.append(renderer.domElement);
    cnv.value.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    const light = new DirectionalLight("white", 3);
    light.position.set(0, 1, 0);
    scene.add(light);
    const ambient = new AmbientLight("#BBBBBB", 1);
    scene.add(ambient);

    const animationLoop = (): void => {
        controls.update();
        light.position.copy(camera.position);
        renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animationLoop);
};

onMounted(() => {

    const resizeObserver = new ResizeObserver((entries) => {

        for(const entry of entries) {
            if(entry.borderBoxSize) {
                canvasWidth.value = entry.borderBoxSize[0].inlineSize;
                canvasHeight.value = entry.borderBoxSize[0].blockSize;
            }
            else {
                canvasWidth.value = entry.contentRect.width;
                canvasHeight.value = entry.contentRect.height;
            }
        }

        camera.aspect = canvasWidth.value/canvasHeight.value;
        camera.updateProjectionMatrix();
        renderer.setSize(canvasWidth.value, canvasHeight.value);
    });

    // Get the canvas size
    const canvas = document.querySelector<HTMLDivElement>(".landscape-viewer");
    if(!canvas) return;
    resizeObserver.observe(canvas);

    initViewer();
});

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    energyLandscapeData = JSON.parse(dataFromMain) as EnergyLandscapeData;

    // Interpolate the scatter points to a regular grid
    const {points, energies} = energyLandscapeData;
	grid = scatterToUniform(gridSide.value,
                            points,
                            energies,
                            power.value);

    renderSurface();
});

/** Close the window on Esc press */
closeWithEscape("/landscape");

watch([gridSide, power], () => {

    if(!energyLandscapeData) return;

    // Interpolate the scatter points to a regular grid
    const {points, energies} = energyLandscapeData;
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

    const colors = Array(pos.count*3).fill(0) as number[];
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

    // Create surface
    const surface = new Mesh(geometry, material);
	surface.rotation.x = -Math.PI/2;
    surface.name = surfaceName;
	scene.add(surface);
};

</script>


<template>
<v-app :theme="theme">
  <div class="landscape-portal">
    <div class="landscape-viewer" ref="view">
    </div>
    <v-container class="landscape-buttons">
      <div class="buttons-line">
        <g-slider-with-steppers v-model="energyScale" class="mb-2"
                                v-model:raw="showEnergyScale" label-width="4.9rem"
                                :label="`Scale (${showEnergyScale})`"
                                :min="0" :max="2" :step="0.1" />
        <g-slider-with-steppers v-model="gridSideExp" class="mb-2"
                                v-model:raw="showGridSideExp" label-width="7.5rem"
                                :label="`Grid side (${2**showGridSideExp})`"
                                :min="6" :max="11" :step="1" />
        <g-slider-with-steppers v-model="power" class="mb-2"
                                v-model:raw="showPower" label-width="5.5rem"
                                :label="`Power (${showPower})`"
                                :min="1" :max="6" :step="0.1" />
        <g-select-colormap v-model="colormapName" class="mt-2 mb-n2" />

        <v-btn v-focus @click="closeWindow('/landscape')" class="mr-2 mb-2">Close</v-btn>
      </div>
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
  flex-direction: column;
  display: flex;
  max-width: 3000px !important;
  padding: 20px 20px 16px 20px !important;
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

</style>
