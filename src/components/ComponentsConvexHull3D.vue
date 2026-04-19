<script setup lang="ts">
/**
 * @component
 * Display convex hull for variable composition results
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-03-08
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
import {onUnmounted, ref, watch, computed} from "vue";
import {BoxGeometry, BufferGeometry, DoubleSide, EdgesGeometry,
        Float32BufferAttribute, LineBasicMaterial, LineLoop,
        Mesh, MeshStandardMaterial, LineSegments, Group,
        FrontSide, Object3D, Color, AmbientLight} from "three";
import {CSS2DRenderer, CSS2DObject} from "three/addons/renderers/CSS2DRenderer.js";
import {Line2, LineGeometry, LineMaterial} from "three/examples/jsm/Addons.js";
import {Lut} from "three/addons/math/Lut.js";
import log from "electron-log";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {SimpleViewer} from "@/services/SimpleViewer";
import type {CtrlParams} from "@/types";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";
import ViewerLegend from "@/widgets/ViewerLegend.vue";
import SelectColormap from "@/widgets/SelectColormap.vue";

const windowPath = "/hull-3d";

const CONTROLS_HEIGHT = 128;

const scale = ref(0.2);
const showScale = ref(0.2);
const pointSize = ref(0.01);
const showPointSize = ref(0.01);
const disableScale = ref(false);
let dimension = 3;
const showLegend = ref(false);
const showLines = ref(true);
const showLabels = ref(true);
const pointColoring = ref("formation");

/** To show error messages */
const notificationQueue = ref<string[]>([]);

/**
 * Report an error on video and on the log file
 *
 * @param message - Error message
 */
const reportError = (message: string): void => {

    notificationQueue.value.push(message);
    log.error(message);
};

let trianglesVertices: number[] = [];
let x: number[] = [];
let y: number[] = [];
let z: number[] = [];
let e: number[] = [];
let v: number[] = [];
let iv: number[] = [];
let zCenter = 0;

let step: number[] = [];
let parts: string[] = [];
let distance: number[] = [];
let formula: string[] = [];

const viewStep = ref("");
const viewParts = ref("");
const viewDistance = ref("");
const viewFormula = ref("");
const viewEnthalpy = ref("");

/** Colormap */
const colormapName = ref("rainbow");
const vertexColors: Color[] = [];
const lutMin = ref(0);
const lutMax = ref(1);

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

// Group containing all points
const pointsGroup = new Group();
const labelsGroup = new Group();

let labelRenderer: CSS2DRenderer;

/** Initialize the 3D viewer */
const sv = new SimpleViewer(".hull3d-viewer", false, (scene) => {

    pointsGroup.name = "ConvexHullPoints";
    scene.add(pointsGroup);
    labelsGroup.name = "ConvexHullLabels";
    scene.add(labelsGroup);

    sv.setRaycaster("Pt", (object?: Object3D): void => {

        // To hide the panel
        if(!object) {
            viewStep.value = "";
            return;
        }

        const idx = object.userData.index as number;

        viewFormula.value = "<b>" + formula[idx] + "</b>";
        viewStep.value = step[idx].toFixed(0);
        viewParts.value = parts[idx].replaceAll("-", ":");
        viewDistance.value = distance[idx].toFixed(4);
        viewEnthalpy.value = e[idx].toFixed(4);
    });

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight-CONTROLS_HEIGHT);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.height = `${window.innerHeight-CONTROLS_HEIGHT}px`;
    labelRenderer.domElement.style.pointerEvents = "none";
    const viewerContainer = document.querySelector(".hull3d-viewer");
    if(viewerContainer) viewerContainer.append(labelRenderer.domElement);

    // Increase ambient light intensity
    scene.traverse((object) => {
        if(object.type === "AmbientLight") {
            const light = object as AmbientLight;
            light.intensity = 1;
        }
    });
},
(scene, camera) => {
    labelRenderer.render(scene, camera);
},
(width: number, height: number) => {
    labelRenderer.setSize(width, height-CONTROLS_HEIGHT);
});

/**
 * Create convex hull surface
 *
 * @param vertices - Triangle vertices of the convex hull surface
 * @param zScale - Scale along z axis
 * @param withSurfaces - Draw also the semitransparent triangles not only the edges
 */
const createSurface = (vertices: number[], zScale: number, withSurfaces=true): void => {

    // Remove existing surface
    const scene = sv.getScene();
    const mesh = scene.getObjectByName("ConvexHull") as Mesh;
    if(mesh) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        mesh.removeFromParent();
    }
    const mesh2 = scene.getObjectByName("ConvexHullEdges") as Mesh;
    if(mesh2) {
        mesh2.geometry.dispose();
        (mesh2.material as LineBasicMaterial).dispose();
        mesh2.removeFromParent();
    }

    // Get surface triangles
    if(vertices.length === 0) return;

    // Define surface material
    const material = new MeshStandardMaterial({
        side: DoubleSide,
        roughness: 0.5,
        metalness: 0.6,
        color: "#FFFFFF",
        transparent: true,
        opacity: 0.5
    });

    // Create convex hull surface
    const geometry = new BufferGeometry();
    const index = [];
    const len = vertices.length/3;
    for(let i=0; i < len; ++i) index.push(i);
    geometry.setIndex(index);
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    if(withSurfaces) {
        geometry.computeVertexNormals();
        geometry.scale(1, 1, zScale);
        const surface = new Mesh(geometry, material);
        surface.name = "ConvexHull";
        scene.add(surface);
    }

    const edges = new EdgesGeometry(geometry, 0); // Zero to get coplanar triangles
	const line = new LineSegments(edges, new LineBasicMaterial({color: "#000000"}));
    line.name = "ConvexHullEdges";
    scene.add(line);

    sv.setSceneModified();
};

/**
 * Create the reference triangle
 */
const createReference3D = (): void => {

    // Remove existing surface
    const scene = sv.getScene();
    const mesh = scene.getObjectByName("ConvexHullRef") as LineLoop;
    if(mesh) {
        mesh.geometry.dispose();
        (mesh.material as LineBasicMaterial).dispose();
        mesh.removeFromParent();
    }

    const points = [
        0, 0, 0,
        1, 0, 0,
        0.5, 0.86602540378, 0,  // √3/2
    ];
    const edges = new BufferGeometry();
    edges.setAttribute("position", new Float32BufferAttribute(points, 3));

    const line = new LineLoop(edges, new LineBasicMaterial({color: "#0000FF"}));
    line.name = "ConvexHullRef";

    scene.add(line);
    sv.setSceneModified();
};

/**
 * Create the reference tetrahedra
 */
const createReference4D = (): void => {

    // Remove existing surface
    const scene = sv.getScene();
    const mesh = scene.getObjectByName("ConvexHullRef") as Mesh;
    if(mesh) {
        mesh.geometry.dispose();
        (mesh.material as LineBasicMaterial).dispose();
        mesh.removeFromParent();
    }

    const points = [
        0, 0, 0,                1, 0, 0,
        1, 0, 0,                0.5, 0.86602540378, 0,
        0.5, 0.86602540378, 0,  0, 0, 0, // √3/2
        0, 0, 0,                0.5, 0.2886751346, 0.86602540378,
        1, 0, 0,                0.5, 0.2886751346, 0.86602540378,
        0.5, 0.86602540378, 0,  0.5, 0.2886751346, 0.86602540378,
    ];

    const geometry = new LineGeometry();
    geometry.setPositions(points);

    const material = new LineMaterial({linewidth: 1, color: "#0000FF"});
    const line = new Line2(geometry, material);
    line.name = "ConvexHullRef";

    scene.add(line);
    sv.setSceneModified();
};

/**
 * Add points corresponding to the structures
 *
 * @param px - Point x position
 * @param py - Point y position
 * @param pz - Point z position
 * @param stableVertices - Points exactly on the convex hull
 * @param zScale - Scale along the z axis
 * @param size - Point size
 */
const createPoints = (px: number[], py: number[], pz: number[],
                      stableVertices: number[], zScale: number,
                      size: number): void => {

    sv.clearGroup("ConvexHullPoints");

    // Points not on the convex hull
    const geometry1 = new BoxGeometry(size, size, size);

    let len = px.length;
    for(let i=0; i < len; ++i) {

        const material = new MeshStandardMaterial({
            side: FrontSide,
            roughness: 0.5,
            metalness: 0.6,
            color: vertexColors.length === 0 ? "#00FF00" : vertexColors[i].convertSRGBToLinear()
        });
        const cube = new Mesh(geometry1, material);
        cube.position.set(px[i], py[i], pz[i]*zScale);
        cube.userData = {index: i};
        cube.name = "Pt";
        pointsGroup.add(cube);
    }

    // Points on the convex hull
    const specialSize = size*1.1;
    const geometry2 = new BoxGeometry(specialSize, specialSize, specialSize);
    const material2 = new MeshStandardMaterial({
        side: FrontSide,
        roughness: 0.5,
        metalness: 0.6,
        color: "#8F0177",
    });

    len = stableVertices.length/3;
    for(let i=0; i < len; ++i) {

        const i3 = 3*i;
        const cube = new Mesh(geometry2, material2);
        cube.position.set(stableVertices[i3], stableVertices[i3+1], stableVertices[i3+2]*zScale);
        pointsGroup.add(cube);
    }

    sv.setSceneModified();
};

/**
 * Create labels on the stable vertices
 *
 * @param stableVertices - Points exactly on the convex hull
 * @param zScale - Scale along the z axis
 * @param indexVertices - Mapping between the stable vertex and the list of points
 * @param formulaText - Label to show on the stable vertices
 */
const createLabels = (stableVertices: number[], zScale: number,
                      indexVertices: number[], formulaText: string[]): void => {

    sv.clearGroup("ConvexHullLabels");
    for(const element of document.querySelectorAll<HTMLDivElement>(".label")) element.remove();

    const len = stableVertices.length/3;
    for(let i=0; i < len; ++i) {

        const text = document.createElement("div");
        text.style.color = "blue";
        text.style.fontSize = "18px";
        text.innerHTML = formulaText[indexVertices[i]];
        text.className = "label";

        const label = new CSS2DObject(text);
        const i3 = 3*i;
        label.position.set(stableVertices[i3],
                            stableVertices[i3+1]*0.9+0.1,
                            stableVertices[i3+2]*zScale);
        labelsGroup.add(label);
    }

    sv.setSceneModified();
};

/**
 * Create colormap for the point values (enthalpy or distance)
 *
 * @param values - Array of points values. If missing the points are colored all green.
 */
const createColors = (values?: number[]): void => {

    if(!values) {
        vertexColors.length = 0;
        return;
    }

    let maxValue = Number.NEGATIVE_INFINITY;
    let minValue = Number.POSITIVE_INFINITY;
    for(const value of values) {
        if(value > maxValue) maxValue = value;
        if(value < minValue) minValue = value;
    }

    const lut = new Lut(colormapName.value, 128);
    lut.setMax(maxValue);
    lut.setMin(minValue);
    lutMin.value = minValue;
    lutMax.value = maxValue;

    vertexColors.length = 0;
    for(const value of values) {

        const color = lut.getColor(value);
        vertexColors.push(color.clone());
    }
};

/** Request the initial data and handle subsequent updates */
requestData(windowPath, (params: CtrlParams) => {

    // Collect the data
    dimension = params.dimension as number;
    if(!dimension) return;

    const tv = params.trianglesVertices as number[];
    trianglesVertices = tv ? [...tv] : [];
    const xx = params.x as number[];
    x = xx ? [...xx] : [];
    const yy = params.y as number[];
    y = yy ? [...yy] : [];
    const zz = params.z as number[];
    z = zz ? [...zz] : [];
    const ee = params.e as number[];
    e = ee ? [...ee] : [];

    const vv = params.vertices as number[];
    v = vv ? [...vv] : [];
    const ii = params.idxVertices as number[];
    iv = ii ? [...ii] : [];

    const ss = params.step as number[];
    step = ss ? [...ss] : [];
    const pp = params.parts as string[];
    parts = pp ? [...pp] : [];

    const dd = params.distance as number[];
    distance = dd ? [...dd] : [];
    const ff = params.formula as string[];
    formula = ff ? [...ff] : [];

    createColors(e);

    if(dimension === 3) {

        createReference3D();
        createSurface(trianglesVertices, scale.value);
        createPoints(x, y, e, v, scale.value, pointSize.value);
        createLabels(v, scale.value, iv, formula);

        // Find the center of the convex hull
        let minEnergy = Number.POSITIVE_INFINITY;
        for(const en of e) if(en < minEnergy) minEnergy = en;
        zCenter = 0.5*minEnergy*scale.value;

        // Move the camera to have the surface at the center of the viewer
        sv.setCamera([0.5, 0.43301, 2], [0.5, 0.43301, zCenter], 20);

        disableScale.value = false;
    }
    else if(dimension === 4) {

        createPoints(x, y, z, v, 1, pointSize.value);
        createSurface(trianglesVertices, 1, false);
        createReference4D();
        createLabels(v, 1, iv, formula);

        // Move the camera to have the surface at the center of the viewer
        sv.setCamera([0.5, 0.43301, 2], [0.5, 0.43301, 0.43301], 20);

        disableScale.value = true;
    }
    else {
        reportError(`Invalid number of components (${dimension}) for convex hull 3D view`);
    }
});

/** Update scene on scale change */
const stopWatcher1 = watch(scale, (sa, sb) => {

    if(sa !== sb) {
        zCenter *= sa/sb;
        sv.setCamera([0.5, 0.43301, 1], [0.5, 0.43301, zCenter], 20);
        createSurface(trianglesVertices, scale.value);
        createPoints(x, y, e, v, scale.value, pointSize.value);
        createLabels(v, scale.value, iv, formula);
    }
});

/** Update scene on point coloring change */
const stopWatcher2 = watch([colormapName, pointColoring, pointSize], () => {

    if(pointColoring.value === "distance") createColors(distance);
    else if(pointColoring.value === "none") createColors();
    else createColors(e);

    if(dimension === 3) {
        createPoints(x, y, e, v, scale.value, pointSize.value);
    }
    else {
        createPoints(x, y, z, v, 1, pointSize.value);
    }
});

// Cleanup
onUnmounted(() => {
    stopWatcher1();
    stopWatcher2();
});

/**
 * Center the view as was in the initial position
 */
const centerView = (): void => {
    sv.setCamera([0.5, 0.43301, 1], [0.5, 0.43301, zCenter], 20);
};

/** Data for the legend */
const vc = computed(() => {
    return {
        min: lutMin.value.toFixed(4),
        max: lutMax.value.toFixed(4),
        colormap: colormapName.value
    };
});

/** Set legend title */
const legendTitle = computed(() => {
    if(pointColoring.value === "distance") return "Distance";
    return "Enthalpy of formation";
});

/**
 * Change visibility of lines and labels
 */
const changeVisibility = (): void => {
    const edges = sv.getScene().getObjectByName("ConvexHullEdges") as Mesh;
    if(edges) edges.visible = showLines.value;
    labelsGroup.visible = showLabels.value;
    sv.setSceneModified();
};

</script>


<template>
<v-app :theme>
  <div class="hull3d-portal">
    <div class="hull3d-viewer" />
    <div v-if="viewStep !== ''" class="hull3d-panel">
      <div v-html="viewFormula"/>
      <table>
        <tbody>
          <tr><td>Step:</td><td class="align">{{ viewStep }}</td></tr>
          <tr><td>Composition:</td><td class="align">{{ viewParts }}</td></tr>
          <tr><td>Enthalpy:</td><td class="align">{{ viewEnthalpy }}</td></tr>
          <tr><td>Distance:</td><td class="align">{{ viewDistance }}</td></tr>
        </tbody>
      </table>
    </div>
    <v-container class="hull3d-controls">
      <slider-with-steppers v-model="scale" v-model:raw="showScale" class="aa"
                            label-width="5.5rem" :disabled="disableScale"
                            :label="`Scale (${showScale})`"
                            :min="0" :max="1" :step="0.01" />
      <slider-with-steppers v-model="pointSize" v-model:raw="showPointSize"
                            label-width="8rem" class="bb"
                            :label="`Point size (${showPointSize})`"
                            :min="0.005" :max="0.05" :step="0.005" />
      <div class="dd">
        <v-switch v-model="showLegend" :disabled="pointColoring === 'none'" label="Show legend"/>
        <select-colormap v-model="colormapName"/>
        <v-btn-toggle v-model="pointColoring" mandatory>
          <v-btn value="none" @click="showLegend=false">None</v-btn>
          <v-btn value="formation">Formation</v-btn>
          <v-btn value="distance">Distance</v-btn>
        </v-btn-toggle>
        <v-switch v-model="showLines" label="Show lines"
                  @update:modelValue="changeVisibility"/>
        <v-switch v-model="showLabels" label="Show labels" class="mr-2"
                  @update:modelValue="changeVisibility"/>
      </div>
      <v-btn class="cc" @click="centerView">Center</v-btn>
      <v-btn v-focus class="ff" @click="closeWindow(windowPath)">Close</v-btn>
    </v-container>
  </div>
  <viewer-legend v-if="showLegend"
                 :width="130" :height="285" :bottom="CONTROLS_HEIGHT" :right="0"
                 :title="legendTitle" :values-continue="vc"/>

  <v-snackbar-queue v-model="notificationQueue" min-height="68"
                    display-strategy="overflow" :total-visible="5"
                    timer="bottom" max-width="250" timeout="6000"
                    close-on-content-click color="red-darken-4" />
</v-app>
</template>


<style scoped>

.hull3d-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 1100px;
  padding: 0;
}

.hull3d-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}

.hull3d-panel {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 800;
  background-color: #7e7e7e46;
  overflow: hidden auto;
  padding: 7px 10px 0 7px !important;
  color: #202020;
}

.align {
  text-align: right;
}

.hull3d-controls {
  display: grid;
  gap: 10px 10px;
  grid-auto-flow: row;
  grid-template:
    "aa bb cc" 1fr
    "dd dd ff" 1fr / 1fr 1fr 0.2fr;
  max-width: 3000px !important;
}

.aa { grid-area: aa; }

.bb { grid-area: bb; }

.cc { grid-area: cc; }

.dd {
  grid-area: dd;
  display: flex;
  flex-direction: row;
  gap: 20px;
}

.ff { grid-area: ff; }

</style>
