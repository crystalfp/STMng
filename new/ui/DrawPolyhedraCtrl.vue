<script setup lang="ts">
/**
 * @component
 * Controls for the polyhedra visualizer.
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
group.name = `DrawPolyhedra-${id}`;
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
    .catch((error: Error) => showAlertMessage(`Error from ask node: ${error.message}`));

watch([showPolyhedra, surfaceColor, colorByCenterAtom, showOpacity], () => {

    sendToNode(id, "look", {
        showPolyhedra: showPolyhedra.value,
        color: surfaceColor.value,
        colorByCenterAtom: colorByCenterAtom.value,
        opacityByCenterAtom: opacityByCenterAtom.value
    });

    group.visible = showPolyhedra.value;
    // TBD
});

watch([labelKind, atomsSelector], () => {

    sendToNode(id, "select", {
        atomsSelector: atomsSelector.value,
        labelKind: labelKind.value
    });
});

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

receivePolyhedraFromNode(id, "vertices",
                         (vertices: number[][], centerAtomsColor: string[]) => {

	// Empty the group
	group.clear();

    let polyhedronIdx = 0;
    let idx = 0;
    for(const island of vertices) {

        // Convert the list of numbers into a THREE.Vector3 list
        const points: THREE.Vector3[] = [];
        const len = island.length;
        for(let i=0; i < len; i += 3) {
            const point = new THREE.Vector3(island[i], island[i+1], island[i+2]);
            points.push(point);
        }

        // The polyhedron
        const mesh = new THREE.Mesh();
        mesh.geometry = new ConvexGeometry(points);
        mesh.name = "Polyhedron";
        let color;
        if(colorByCenterAtom.value) {
            const polyhedraMaterial = material.clone();
            color = new THREE.Color(centerAtomsColor[idx]);
            polyhedraMaterial.color = color;
            mesh.material = polyhedraMaterial;

            ++idx;
        }
        else {
            mesh.material = material.clone();
            color = material.color;
        }
        group.add(mesh);

        // Identify the polyhedron
        mesh.userData = {idx: polyhedronIdx};
        ++polyhedronIdx;

        // The polyhedron edges
        const edgeColor = createContrastingColor(color);
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color: edgeColor}));
        group.add(line);
    }

    group.visible = showPolyhedra.value;
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
  <g-slider-with-steppers v-if="colorByCenterAtom" v-model="opacityByCenterAtom" v-model:raw="showOpacity"
                          :label="`Opacity (${showOpacity.toFixed(1)})`"
                          :min="0" :max="1" :step="0.1" />
  <g-color-selector v-else v-model="surfaceColor" label="Surface color" :transparency="true" />
</v-container>
</template>
