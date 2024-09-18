<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {ref, watch} from "vue";
import {askNode, sendToNode, receivePolyhedraFromNode} from "../services/RoutesClient";
import {showAlertMessage} from "../services/AlertMessage";
import * as THREE from "three";
import {ConvexGeometry} from "three/addons/geometries/ConvexGeometry.js";
import {sm} from "../services/SceneManager";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// > Initialization
const showPolyhedra = ref(true);
const surfaceColor = ref("#FFFFFF80");
const labelKind = ref("symbol");
const atomsSelector = ref("");
const colorByCenterAtom = ref(false);
const opacityByCenterAtom = ref(0.5);
const showOpacity = ref(0.5);

const material = new THREE.MeshLambertMaterial({
										color: "#FFFFFF",
										opacity: 0.5,
										side: THREE.FrontSide,
										transparent: true,
										polygonOffset: true,
										polygonOffsetFactor: 1
									});

const group: THREE.Group = new THREE.Group();
group.name = "DrawPolyhedra-" + id;
sm.add(group);

askNode(id, "init")
    .then((params) => {

		surfaceColor.value = params.color as string ?? "#FFFFFF80";
		labelKind.value = params.labelKind as string ?? "symbol";
		atomsSelector.value = params.atomsSelector as string ?? "";
		showPolyhedra.value = params.showPolyhedra as boolean ?? true;
		colorByCenterAtom.value = params.colorByCenterAtom as boolean ?? true;
		opacityByCenterAtom.value = params.opacityByCenterAtom as number ?? 0.5;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for DrawPolyhedra: ${error.message}`));

// > Utility functions
/**
 * Extract the color from a string containing alpha
 *
 * @param color - Color in #RRGGBBAA format
 * @returns The color part
 */
const extractColor = (color: string): THREE.Color => {

    const colorString = color.slice(0, 7);
    return new THREE.Color(colorString);
};

/**
 * Extract the opacity from a string containing alpha
 *
 * @param color - Color in #RRGGBBAA format
 * @returns The opacity value
 */
const extractOpacity = (color: string): number => {

    if(color.length < 9) return 1;
    return Number.parseInt(color.slice(7, 9), 16) / 255;
};

/**
 * Find a contrasting color
 *
 * @param materialColor - Polyhedra color
 * @param bw - True (default) to create contrasting black and white color
 * @returns Color for the polyhedra edges
 */
const createContrastingColor = (materialColor: THREE.Color, bw=true): number => {

    const {r, g, b} = materialColor;

    // B&W output (https://stackoverflow.com/a/3943023/112731)
    if(bw) return (r * 76.245 + g * 149.685 + b * 29.07) > 186 ? 0x000000 : 0xFFFFFF;

    // Invert color components
    return (((1-r)*255 + (1-g))*255 + (1-b))*255;
};

/** Received vertex coordinates and colors */
const polyhedraVertices: THREE.Vector3[][] = [];
const centerAtomColorList: string[] = [];
let countPolyhedra = 0;

/**
 * Create the graphical objects
 */
const drawPolyhedra = (): void => {

	// Empty the group
	group.clear();

    for(let i=0; i < countPolyhedra; ++i) {

        // The polyhedron
        const mesh = new THREE.Mesh();
        mesh.geometry = new ConvexGeometry(polyhedraVertices[i]);
        mesh.name = "Polyhedron";
        let color;
        if(colorByCenterAtom.value) {
            const polyhedraMaterial = material.clone();
            color = new THREE.Color(centerAtomColorList[i]);
            polyhedraMaterial.color = color;
            mesh.material = polyhedraMaterial;
        }
        else {
            mesh.material = material.clone();
            color = material.color;
        }
        group.add(mesh);

        // Identify the polyhedron
        mesh.userData = {idx: i};

        // The polyhedron edges
        const edgeColor = createContrastingColor(color);
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: edgeColor}));
        group.add(line);
    }

    group.visible = showPolyhedra.value;
};

// > React to changes
watch([showPolyhedra, surfaceColor, colorByCenterAtom, opacityByCenterAtom], () => {

    sendToNode(id, "look", {
        showPolyhedra: showPolyhedra.value,
        color: surfaceColor.value,
        colorByCenterAtom: colorByCenterAtom.value,
        opacityByCenterAtom: opacityByCenterAtom.value
    });

    // If only visibility changes
    if(group.visible !== showPolyhedra.value) {
        group.visible = showPolyhedra.value;
        return;
    }

    // Change material
    if(colorByCenterAtom.value) {
        material.opacity = opacityByCenterAtom.value;
    }
    else {
        material.color = extractColor(surfaceColor.value);
        material.opacity = extractOpacity(surfaceColor.value);
    }

    // Redraw polyhedron
    drawPolyhedra();
});

watch([labelKind, atomsSelector], () => {

    sendToNode(id, "select", {
        atomsSelector: atomsSelector.value,
        labelKind: labelKind.value
    });
});

receivePolyhedraFromNode(id, "vertices",
                         (vertices: number[][], centerAtomsColor: string[]) => {

    // Format the received data
    polyhedraVertices.length = 0;
    centerAtomColorList.length = 0;
    countPolyhedra = vertices.length;
    for(let i=0; i < countPolyhedra; ++i) {

        // Convert the list of coordinates into a THREE.Vector3 list
        const points: THREE.Vector3[] = [];
        const len = vertices[i].length;
        for(let j=0; j < len; j += 3) {
            const point = new THREE.Vector3(vertices[i][j], vertices[i][j+1], vertices[i][j+2]);
            points.push(point);
        }
        polyhedraVertices.push(points);

        // Save the list of center atoms colors
        centerAtomColorList.push(centerAtomsColor[i]);
    }

    // Render the polyhedron
    drawPolyhedra();
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showPolyhedra" color="primary" label="Show polyhedra" density="compact"
            class="mt-2 ml-4" />
  <v-switch v-model="colorByCenterAtom" color="primary" label="Color by center atom" density="compact"
            class="mt-n5 ml-4" />
  <g-atoms-selector v-model:kind="labelKind" v-model:selector="atomsSelector"
                    class="ml-2 mb-6"
                    title="Select central atoms by" placeholder="Central atoms selector" />
  <g-slider-with-steppers v-if="colorByCenterAtom" v-model="opacityByCenterAtom"
                          v-model:raw="showOpacity" label-width="7rem"
                          :label="`Opacity (${showOpacity.toFixed(1)})`"
                          :min="0" :max="1" :step="0.1" />
  <g-color-selector v-else v-model="surfaceColor" label="Surface color" :transparency="true" />
</v-container>
</template>
