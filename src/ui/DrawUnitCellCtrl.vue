<script setup lang="ts">
/**
 * @component
 * Controls for the unit cell / supercell visualization.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import * as THREE from "three";
import {ref, watch} from "vue";
import {askNode, receiveVerticesFromNode, sendToNode} from "@/services/RoutesClient";
import {showAlertMessage} from "@/services/AlertMessage";
import {sm} from "@/services/SceneManager";
import {spriteText} from "@/services/SpriteText";

// > Properties
const {id} = defineProps<{

    /** Its own module id */
    id: string;
}>();

// Unit cell
const showUnitCell = ref(true);
const lineColor = ref("#0000FF");
const dashedLine = ref(false);
const showBasisVectors = ref(false);

// Supercell
const repetitionsA = ref(1);
const repetitionsB = ref(1);
const repetitionsC = ref(1);
const showSupercell = ref(false);
const supercellColor = ref("#16A004");
const dashedSupercell = ref(false);

const showRepetitionsA = ref(1);
const showRepetitionsB = ref(1);
const showRepetitionsC = ref(1);

// Adjust origin
const percentA = ref(0);
const percentB = ref(0);
const percentC = ref(0);
const shrink   = ref(true);

const showPercentA = ref(0);
const showPercentB = ref(0);
const showPercentC = ref(0);

// 3D Objects
const outBV = new THREE.Group();
let lineUC: THREE.LineSegments | undefined;
let lineSC: THREE.LineSegments | undefined;

/**
 * Check if a supercell has been requested
 *
 * @returns True if there is a repetition
 */
const hasSupercell = (): boolean => repetitionsA.value > 1 || repetitionsB.value > 1 || repetitionsC.value > 1;

// > Initialize ui
askNode(id, "init")
    .then((params) => {

        repetitionsA.value = params.repetitionsA as number ?? 1;
        repetitionsB.value = params.repetitionsB as number ?? 1;
        repetitionsC.value = params.repetitionsC as number ?? 1;
        lineColor.value = params.lineColor as string ?? "#0000FF";
        showBasisVectors.value = params.showBasisVectors as boolean ?? false;
        dashedLine.value = params.dashedLine as boolean ?? false;
        showUnitCell.value = params.showUnitCell as boolean ?? true;
        showSupercell.value = params.showSupercell as boolean ?? hasSupercell();
        supercellColor.value = params.supercellColor as string ?? "#16A004";
        dashedSupercell.value = params.dashedSupercell as boolean ?? false;

        percentA.value = params.percentA as number ?? 0;
        percentB.value = params.percentB as number ?? 0;
        percentC.value = params.percentC as number ?? 0;
        shrink.value = params.shrink as boolean ?? true;
    })
    .catch((error: Error) => showAlertMessage(`Error from UI init for DrawUnitCell: ${error.message}`));

// Triangles. Top and bottom facies are not needed
const indices = [
    // 0, 1, 2,
    // 0, 2, 3,

    4, 5, 1,
    4, 1, 0,

    3, 2, 6,
    3, 6, 7,

    4, 0, 3,
    4, 3, 7,

    1, 5, 6,
    1, 6, 2,

    // 5, 4, 7,
    // 5, 7, 6,
];

// Prepare the names of the various graphical objects
const nameUC = "DrawUnitCell-" + id;
const nameSC = "DrawSupercell-" + id;
const nameBV = "DrawBasisVectors-" + id;

// Prepare the group and add it to the scene
outBV.name = nameBV;
sm.add(outBV);
sm.clearGroup(nameBV);

/**
 * Define the material to be used to draw the lines
 *
 * @param color - Color of the lines
 * @param dashed - If the line should be dashed
 * @returns The material to apply to the lines
 */
const setMaterial = (color: string, dashed: boolean): THREE.Material =>
    (dashed ? new THREE.LineDashedMaterial({
                    color,
                    scale: 5,
                    dashSize: 1,
                    gapSize: 1,
                }) :
                new THREE.LineBasicMaterial({
                    color
                })
    );

/**
 * Prepare the cell mesh (Unit Cell or Supercell)
 *
 * @param vertices - Vertices of the cell
 * @param name - Name of the mesh
 * @param color - Color of the line mesh
 * @param dashed - If line should be dashed
 * @returns The mesh or undefined if nno vertices present
 */
const drawCell = (vertices: number[], name: string, color: string, dashed: boolean): THREE.LineSegments | undefined => {

    // Clear previous cell
    sm.deleteMesh(name);

    // If no unit cell return
    if(vertices.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
    const edges = new THREE.EdgesGeometry(geometry);

    const line = new THREE.LineSegments(edges, setMaterial(color, dashed));
    if(dashed) line.computeLineDistances();
    line.name = name;

    // eslint-disable-next-line @typescript-eslint/consistent-return
    return line;
};

// Render the unit cell
receiveVerticesFromNode(id, "cell", (vertices: number[]) => {

    const line = drawCell(vertices, nameUC, lineColor.value, dashedLine.value);
    if(line) {

        lineUC = line;
        lineUC.visible = showUnitCell.value;
        sm.add(lineUC);
    }
});

// Render the supercell
receiveVerticesFromNode(id, "supercell", (vertices: number[]) => {

    const line = drawCell(vertices, nameSC, supercellColor.value, dashedSupercell.value);
    if(line) {

        lineSC = line;
        lineSC.visible = showSupercell.value;
        sm.add(lineSC);
    }
});

/**
 * From a direction extract needed rotation
 *
 * @param versor - Direction versor
 * @param quaternion - Resulting rotation quaternion
 */
const setDirection = (versor: THREE.Vector3, quaternion: THREE.Quaternion): void => {

    // Versor is assumed to be normalized
    if(versor.y > 0.99999) quaternion.set(0, 0, 0, 1);
    else if(versor.y < -0.99999) quaternion.set(1, 0, 0, 0);
    else {
        const rotationAxis = new THREE.Vector3(versor.z, 0, -versor.x).normalize();
        const radians = Math.acos(versor.y);
        quaternion.setFromAxisAngle(rotationAxis, radians);
    }
};

/**
* Create an arrow in the direction of the basis vector
*
* @param basis - Basis vector to be show
* @param origin - Unit cell origin
* @param color - Color of the arrow and the label
* @param label - Label of the vector
* @param group - The arrow is added to this group
*/
const basisVectorArrow = (basis: THREE.Vector3, origin: THREE.Vector3,
                          color: string, label: string, group: THREE.Group): void => {

    const versor = basis.clone().normalize();
    const basisLen = basis.length();

    const size = 0.05;
    const coneSize = 2*size;
    const coneLen = 5*size;

    const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(size, size, basisLen-coneLen, 10),
        new THREE.MeshBasicMaterial({color})
    );

    setDirection(versor, cylinder.quaternion);
    cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

    // Arrow tips
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneSize, coneLen, 8, 1),
        new THREE.MeshBasicMaterial({color})
    );

    cone.quaternion.copy(cylinder.quaternion);
    cone.position.addVectors(basis, origin);
    cone.position.addScaledVector(versor, -coneLen/2);

    // Label
    const sprite = spriteText(label,
                              color,
                              [basis.x+origin.x, basis.y+origin.y, basis.z+origin.z],
                              [versor.x*0.1, versor.y*0.1, versor.z*0.1]);

    group.add(cylinder, cone, sprite);
};

// Render the basis vectors
receiveVerticesFromNode(id, "vectors", (vertices: number[]) => {

    // Clear basis vectors
    sm.clearGroup(nameBV);

    // Not visible, do nothing
    if(vertices.length < 12) return;

    // vertices[0-8]: basis; vertices[9-11]: origin
    // Basis vectors visible, create them
    const originZero = new THREE.Vector3(vertices[9], vertices[10], vertices[11]);

    const basisA = new THREE.Vector3(vertices[0], vertices[1], vertices[2]);
    const basisB = new THREE.Vector3(vertices[3], vertices[4], vertices[5]);
    const basisC = new THREE.Vector3(vertices[6], vertices[7], vertices[8]);

    basisVectorArrow(basisA, originZero, "#FF0000", "a", outBV);
    basisVectorArrow(basisB, originZero, "#79FF00", "b", outBV);
    basisVectorArrow(basisC, originZero, "#0000FF", "c", outBV);

    outBV.visible = showBasisVectors.value;
});


/**
 * Change the materials
 */
const changeMaterials = (): void => {
    if(lineUC) {
        lineUC.material = setMaterial(lineColor.value, dashedLine.value);
        if(dashedLine.value) lineUC.computeLineDistances();
    }
    if(lineSC) {
        lineSC.material = setMaterial(supercellColor.value, dashedSupercell.value);
        if(dashedSupercell.value) lineSC.computeLineDistances();
    }
};

/**
 * Reset repetition sliders to default values
 */
const resetSliders = (): void => {

    repetitionsA.value = 1;
    repetitionsB.value = 1;
    repetitionsC.value = 1;
    showSupercell.value = false;

    showRepetitionsA.value = 1;
    showRepetitionsB.value = 1;
    showRepetitionsC.value = 1;
};

watch([showUnitCell, showSupercell, showBasisVectors], () => {

    if(lineUC) lineUC.visible = showUnitCell.value;
    if(lineSC) lineSC.visible = showSupercell.value;
    outBV.visible = showBasisVectors.value;

    sendToNode(id, "visible", {
        showUnitCell: showUnitCell.value,
        showSupercell: showSupercell.value,
        showBasisVectors: showBasisVectors.value
    });
});

watch([repetitionsA, repetitionsB, repetitionsC], () => {

    showSupercell.value = hasSupercell();
    sendToNode(id, "repeat", {
        repetitionsA: repetitionsA.value,
        repetitionsB: repetitionsB.value,
        repetitionsC: repetitionsC.value
    });
});

watch([dashedLine, lineColor, dashedSupercell, supercellColor], () => {

    changeMaterials();
    sendToNode(id, "appear", {
		dashedLine: dashedLine.value,
		lineColor: lineColor.value,
        supercellColor: supercellColor.value,
        dashedSupercell: dashedSupercell.value,
   });
});

watch([percentA, percentB, percentC, shrink], () => {

    sendToNode(id, "origin", {
        percentA: percentA.value,
        percentB: percentB.value,
        percentC: percentC.value,
        shrink: shrink.value
    });
});

</script>


<template>
<v-container class="container">
  <v-switch v-model="showUnitCell" color="primary" label="Show unit cell" class="mt-2 ml-4" />
  <v-switch v-model="dashedLine" color="primary" label="Dashed lines" class="ml-4 mt-n5" />
  <v-switch v-model="showBasisVectors" color="primary" label="Show basis vectors" class="ml-4 mt-n5" />
  <g-color-selector v-model="lineColor" label="Line color" />
  <v-divider thickness="8" class="mb-4" />
  <v-label text="Cell repetitions" class="ml-2 mb-1 yellow-title no-select" />
  <g-slider-with-steppers v-model="repetitionsA" v-model:raw="showRepetitionsA"
                          :label="`Along a (${showRepetitionsA})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsB" v-model:raw="showRepetitionsB"
                          :label="`Along b (${showRepetitionsB})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <g-slider-with-steppers v-model="repetitionsC" v-model:raw="showRepetitionsC"
                          :label="`Along c (${showRepetitionsC})`" label-width="5.5rem"
                          :min="1" :max="10" :step="1" />
  <v-btn :disabled="!hasSupercell()" class="mt-2 mb-4 ml-2 w-50" @click="resetSliders">
    Reset
  </v-btn>
  <v-switch v-model="showSupercell" color="primary" :disabled="!hasSupercell()" label="Show supercell" class="ml-4" />
  <v-switch v-model="dashedSupercell" color="primary" label="Dashed lines supercell" class="ml-4 mt-n5" />
  <g-color-selector v-model="supercellColor" label="Line color" />
  <v-divider thickness="8" class="mb-4" />
  <v-label text="Shift origin (by fraction of basis)" class="ml-2 mb-3 yellow-title no-select" />
  <g-slider-with-steppers v-model="percentA" v-model:raw="showPercentA"
                          :label="`Along a (${showPercentA}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentB" v-model:raw="showPercentB"
                          :label="`Along b (${showPercentB}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <g-slider-with-steppers v-model="percentC" v-model:raw="showPercentC"
                          :label="`Along c (${showPercentC}%)`" label-width="7.2rem"
                          :min="0" :max="50" :step="1" />
  <v-switch v-model="shrink" color="primary" label="Shrink cell" class="ml-4 mt-2" />

</v-container>
</template>
