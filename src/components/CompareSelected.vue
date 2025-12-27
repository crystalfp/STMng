<script setup lang="ts">
/**
 * @component
 * Compare two structures selected in the scatterplot.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-24
 */
import {ref, reactive, watch} from "vue";
import log from "electron-log";
import {Scene, Group, LineBasicMaterial, Vector3, Quaternion, MathUtils,
        LineSegments, IcosahedronGeometry, MeshStandardMaterial, Mesh,
        CylinderGeometry, FrontSide} from "three";
import {SimpleViewer} from "@/services/SimpleViewer";
import {theme} from "@/services/ReceiveTheme";
import {showSystemAlert} from "@/services/AlertMessage";
import {askNode, closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import {computeCellVertices} from "@/electron/modules/ComputeCellVertices";
import {computeCellEdges} from "@/services/ComputeCellEdges";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import type {BasisType, CtrlParams} from "@/types";

import SliderWithSteppers from "@/widgets/SliderWithSteppers.vue";

/**
 * List of structures to compare (don't use shallowRef)
 * @notExported
 */
interface Selection {

    /** Structure step */
    step: number;

    /** Selected on the left column */
    selected0: boolean;

    /** Selected on the right column */
    selected1: boolean;

    /** Disabled on the left column */
    disabled0: boolean;

    /** Disabled on the right column */
    disabled1: boolean;
}
const lines = reactive<Selection[]>([]);

/**
 * Side: 0: left, 1: right
 * @notExported
 */
type Side = 0 | 1;

/** The selected step on the two columns (-1 means no selection) */
const selectedStep0 = ref(-1);
const selectedStep1 = ref(-1);

/** Graphical variables */
let groupRight: Group;
let groupLeft: Group;

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/compare");

/**
 * Initialize the viewer
 */
const sv = new SimpleViewer(".side-n", false, (scene: Scene) => {

    groupLeft = new Group();
    scene.add(groupLeft);
    groupRight = new Group();
    scene.add(groupRight);
});

const colors = [
    "blue",
    "green"
];

/**
 * Draw the unit cell
 *
 * @param basis - The basis for the unit cell
 * @param side - Side of the related structure
 * @returns - Unit cell center coordinates
 */
const drawUnitCell = (basis: BasisType, side: Side): [number, number, number] => {

    const material = new LineBasicMaterial({color: colors[side]});
    const vertices = computeCellVertices([0, 0, 0], basis);
    const edges = computeCellEdges(vertices);
    const line = new LineSegments(edges, material);

    if(side) groupRight.add(line);
    else     groupLeft.add(line);

    // Compute the center of the unit cell
    const center: [number, number, number] = [0, 0, 0];
    for(let i=0; i < 8; ++i) {
        for(let j=0; j < 3; ++j) {
            center[j] += vertices[3*i+j];
        }
    }
    for(let j=0; j < 3; ++j) center[j] /= 8;

    return center;
};

/**
 * Draw the atoms
 *
 * @param atomsPosition - Positions of the atoms
 * @param radii - List of atoms radii for display
 * @param side - Side of the related structure
 */
const drawAtoms = (atomsPosition: number[], radii: number[], side: Side): void => {

    const material = new MeshStandardMaterial({
        color: colors[side],
        roughness: 0.5,
        metalness: 0.6,
        side: FrontSide,
    });

    const natoms = radii.length;
    for(let i=0; i < natoms; ++i) {

        const geometry = new IcosahedronGeometry(radii[i], 3);

        const sphere = new Mesh(geometry, material);
        sphere.position.set(atomsPosition[3*i], atomsPosition[3*i+1], atomsPosition[3*i+2]);

        if(side) groupRight.add(sphere);
        else     groupLeft.add(sphere);
    }
};

/**
 * Draw the bonds
 *
 * @param atomsPosition - Positions of the atoms
 * @param bonds - List of indices of bonded atoms
 * @param side - Side of the related structure
 */
const drawBonds = (atomsPosition: number[], bonds: number[], side: Side): void => {

    const len = bonds.length;

    for(let i=0; i < len; i+=2) {

        const from = bonds[i];
        const to   = bonds[i+1];

        const dx = atomsPosition[3*to+0] - atomsPosition[3*from+0];
        const dy = atomsPosition[3*to+1] - atomsPosition[3*from+1];
        const dz = atomsPosition[3*to+2] - atomsPosition[3*from+2];
        const bondLen = Math.hypot(dx, dy, dz);

        const geometry = new CylinderGeometry(0.1, 0.1, bondLen, 10, 1, true);

        const meshMaterial = new MeshStandardMaterial({
            color: colors[side],
            roughness: 0.5,
            metalness: 0.6,
            side: FrontSide,
        });

        const cylinder = new Mesh(geometry, meshMaterial);

		// Rotate it along the bond direction
		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx/bondLen, dy/bondLen, dz/bondLen));

		// Move it to the midpoint between atoms
        const midx = (atomsPosition[3*to+0] + atomsPosition[3*from+0])/2;
        const midy = (atomsPosition[3*to+1] + atomsPosition[3*from+1])/2;
        const midz = (atomsPosition[3*to+2] + atomsPosition[3*from+2])/2;
		cylinder.position.set(midx, midy, midz);

		// Add to the scene
        if(side) groupRight.add(cylinder);
        else     groupLeft.add(cylinder);
    }
};

/** Versors of the basis vectors */
let na = new Vector3(1, 0, 0);
let nb = new Vector3(0, 1, 0);
let nc = new Vector3(0, 0, 1);

/**
 * Load the requested structure
 *
 * @param side - Side of the list (0: left, 1: right)
 * @param step - Step that should be loaded
 */
const loadStructure = (side: Side, step: number): void => {

    askNode("SYSTEM", "get-structure", {step})
        .then((response: CtrlParams) => {
            if(!("basis" in response)) throw Error("Cannot load the requested structure");

            const bb = response.basis as BasisType;

            const center = drawUnitCell(bb, side);
            drawAtoms(response.positions as number[], response.radii as number[], side);
            drawBonds(response.positions as number[], response.bonds as number[], side);

            if(side === 0) {
                na = new Vector3(bb[0], bb[1], bb[2]).normalize();
                nb = new Vector3(bb[3], bb[4], bb[5]).normalize();
                nc = new Vector3(bb[6], bb[7], bb[8]).normalize();

                sv.centerCamera(center);
            }
            sv.setSceneModified();
        })
        .catch((error: Error) => {

            showSystemAlert(`Error getting structure. Error: ${error.message}`);
        });
};

/**
 * Remove the visualized structure
 *
 * @param side - Side of the list (0: left, 1: right)
 */
const unloadStructure = (side: Side): void => {

    if(side) groupRight.clear();
    else     groupLeft.clear();
    sv.setSceneModified();
};

/**
 * Send the updated selected steps list
 */
const updateSelection = (): void => {

    const steps = [];
    for(const entry of lines) steps.push(entry.step);
    sendToNode("SYSTEM", "updated-selection", {updatedStepsSelection: steps});
};

// Load values from main
receiveInWindow((dataFromMain) => {

    const steps = JSON.parse(dataFromMain) as number[];
    const len = steps.length;
    lines.length = 0;
    if(len === 0) return;
    for(let i=0; i < len; ++i) lines.push({
        step: steps[i], selected0: false, selected1: false, disabled0: false, disabled1: false
    });
});

/**
 * Convert step into a list position
 *
 * @param step - Step for which the position in list should be found
 * @returns The corresponding index
 */
const findIdx = (step: number): number => {

    const len = lines.length;
    for(let idx=0; idx < len; ++idx) {
        if(lines[idx].step === step) return idx;
    }
    log.error("Step not found");
    return 0;
};

/**
 * Enable all element of a column except the one provided
 *
 * @param side - Side of the list (0: left, 1: right)
 * @param idx - If set enable all elements except this one
 */
const enableAllExcept = (side: Side, idx?: number): void => {

    if(side) {
        for(const entry of lines) entry.disabled1 = false;
        if(idx !== undefined) lines[idx].disabled1 = true;
    }
    else {
        for(const entry of lines) entry.disabled0 = false;
        if(idx !== undefined) lines[idx].disabled0 = true;
    }
};

/**
 * Select one entry by clicking on it
 *
 * @param side - Side of the list (0: left, 1: right)
 * @param step - Step that has been selected
 */
const select = (side: Side, step: number): void => {

    const idx = findIdx(step);

    if(side) {
        if(step === selectedStep0.value) return;
        if(step === selectedStep1.value) {
            lines[idx].selected1 = false;
            selectedStep1.value = -1;
            unloadStructure(1);
            enableAllExcept(0);
        }
        else {
            if(selectedStep1.value !== -1) {
                const idx1 = findIdx(selectedStep1.value);
                lines[idx1].selected1 = false;
                unloadStructure(1);
            }
            lines[idx].selected1 = true;
            selectedStep1.value = step;
            loadStructure(1, step);
            enableAllExcept(0, idx);
        }
    }
    else {
        if(step === selectedStep1.value) return;
        if(step === selectedStep0.value) {
            lines[idx].selected0 = false;
            selectedStep0.value = -1;
            unloadStructure(0);
            enableAllExcept(1);
        }
        else {
            if(selectedStep0.value !== -1) {
                const idx0 = findIdx(selectedStep0.value);
                lines[idx0].selected0 = false;
                unloadStructure(0);
            }
            lines[idx].selected0 = true;
            selectedStep0.value = step;
            loadStructure(0, step);
            enableAllExcept(1, idx);
        }
    }
};

/**
 * Remove an entry from the list
 *
 * @param side - Remove the selected from the given side
 */
const remove = (side: Side): void => {

    let step;
    if(side) {
        if(selectedStep1.value === -1) return;
        step = selectedStep1.value;
        selectedStep1.value = -1;
        if(selectedStep0.value === step) {
            selectedStep0.value = -1;
        }
    }
    else {
        if(selectedStep0.value === -1) return;
        step = selectedStep0.value;
        selectedStep0.value = -1;
        if(selectedStep1.value === step) {
            selectedStep1.value = -1;
        }
    }

    const idx = findIdx(step);
    unloadStructure(side);
    lines.splice(idx, 1);
    updateSelection();
};

/** Angles of rotation around left basis vectors */
const aroundA = ref(0);
const showAroundA = ref(0);
const aroundB = ref(0);
const showAroundB = ref(0);
const aroundC = ref(0);
const showAroundC = ref(0);

/**
 * Reset the rotation angles
 */
const resetRotations = (): void => {
  aroundA.value = 0;
  showAroundA.value = 0;
  aroundB.value = 0;
  showAroundB.value = 0;
  aroundC.value = 0;
  showAroundC.value = 0;
};

watch([aroundA, aroundB, aroundC],
      ([aAfter, bAfter, cAfter], [aBefore, bBefore, cBefore]) => {

    if(selectedStep0.value === -1 || selectedStep1.value === -1) return;

    if(aAfter !== aBefore) {
        const angle = (aAfter-aBefore)*MathUtils.DEG2RAD;
        groupRight.applyQuaternion(new Quaternion().setFromAxisAngle(na, angle));
    }
    if(bAfter !== bBefore) {
        const angle = (bAfter-bBefore)*MathUtils.DEG2RAD;
        groupRight.applyQuaternion(new Quaternion().setFromAxisAngle(nb, angle));
    }
    if(cAfter !== cBefore) {
        const angle = (cAfter-cBefore)*MathUtils.DEG2RAD;
        groupRight.applyQuaternion(new Quaternion().setFromAxisAngle(nc, angle));
    }
    sv.setSceneModified();
});

</script>


<template>
<v-app :theme>
  <div class="compare-grid">
    <div class="side-w px-2">
      <v-label class="sub-tt separator-title first-title">Compare selected</v-label>
      <div class="sub-tl"></div>
      <div class="sub-tr"></div>
      <div class="sub-cl">
        <div v-for="line of lines" :key="line.step" v-ripple
             class="entry" :class="{selected: line.selected0, disabled: line.disabled0}"
             @click="select(0, line.step)">{{ line.step }}</div>
      </div>
      <div class="sub-cr">
        <div v-for="line of lines" :key="line.step" v-ripple
             class="entry" :class="{selected: line.selected1, disabled: line.disabled1}"
             @click="select(1, line.step)">{{ line.step }}</div>
      </div>
      <v-btn class="sub-bl" :disabled="selectedStep0 === -1" @click="remove(0)">Remove</v-btn>
      <v-btn class="sub-br" :disabled="selectedStep1 === -1" @click="remove(1)">Remove</v-btn>
    </div>
    <div class="side-n" />
    <div class="side-s">
      <slider-with-steppers v-model="aroundA" v-model:raw="showAroundA"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      label-width="7.4rem" :label="`Around: a (${showAroundA}°)`"
                      :min="-180" :max="180" :step="1" :timeout="0" />
      <slider-with-steppers v-model="aroundB" v-model:raw="showAroundB"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      label-width="4rem" :label="`b (${showAroundB}°)`"
                      :min="-180" :max="180" :step="1" :timeout="0" />
      <slider-with-steppers v-model="aroundC" v-model:raw="showAroundC"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      label-width="4rem" :label="`c (${showAroundC}°)`"
                      :min="-180" :max="180" :step="1" :timeout="0" />
      <v-btn v-focus :disabled="selectedStep0 === -1 || selectedStep1 === -1"
             @click="resetRotations">Reset</v-btn>
      <v-btn v-focus @click="closeWindow('/compare')">Close</v-btn>
    </div>
  </div>
</v-app>
</template>


<style scoped>
.compare-grid {
  display: grid;
  gap: 0;
  grid-auto-flow: row;
  grid-template:
    "aa bb" 1fr
    "aa cc" 50px / 280px 1fr;
  height: 100vh;
}

.side-w {
  grid-area: aa;
  display: grid;
  gap: 0 5px;
  grid-auto-flow: row;
  grid-template:
    "tt tt" 50px
    "tl tr" 20px
    "cl cr" 1fr
    "bl br" 45px / 1fr 1fr;
  height: 100vh;
}

.side-n {
  grid-area: bb;
  overflow: hidden;
}

.side-s {
  grid-area: cc;
  justify-content: end;
  display: flex;
  align-items: center;
  max-width: 3000px !important;
  gap: 10px;
  padding-right: 10px !important;
  width: 100%
}

.sub-tt {grid-area: tt;}
.sub-tl {grid-area: tl; background-color: blue;}
.sub-tr {grid-area: tr; background-color: green;}
.sub-cl {grid-area: cl; overflow-y: auto; margin-bottom: 10px;}
.sub-cr {grid-area: cr; overflow-y: auto; margin-bottom: 10px;}
.sub-bl {grid-area: bl;}
.sub-br {grid-area: br;}

.selected {
  background-color: rgb(var(--v-theme-surface-variant), 0.3);
}

.disabled {
  color: light-dark(rgb(16 16 16 / 0.3), rgb(255 255 255 / 0.3));
}

.entry {
  cursor: pointer;
  text-align-last: right;
}
</style>
