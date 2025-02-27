<script setup lang="ts">
/**
 * @component
 * Compare two structures selected in the scatterplot.
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-24
 */
import {onMounted, ref, useTemplateRef, watch} from "vue";
import log from "electron-log";
import {Scene, Color, OrthographicCamera, WebGLRenderer, DirectionalLight,
        AmbientLight, Group, LineBasicMaterial, BufferGeometry,
        Vector3, Vector2, Vector4, Quaternion, Matrix4, Spherical, Box3,
        Sphere, MathUtils, Raycaster,
        BufferAttribute, EdgesGeometry, LineSegments,
        Clock, IcosahedronGeometry, MeshStandardMaterial, Mesh,
        CylinderGeometry, FrontSide} from "three";
import CameraControls from "camera-controls";
import {theme} from "@/services/ReceiveTheme";
import {askNode, closeWindow, receiveInWindow, sendToNode} from "@/services/RoutesClient";
import type {BasisType, CtrlParams} from "@/types";

/** List of structures to compare */
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
const lines = ref<Selection[]>([]);

/** Side: 0: left, 1: right */
type Side = 0 | 1;

/** The selected step on the two columns (-1 means no selection) */
const selectedStep0 = ref(-1);
const selectedStep1 = ref(-1);

/** Reference to the view */
const cnv = useTemplateRef<HTMLElement>("viewCompare");

/** The canvas sizes (will be computed during mount or resize) */
const canvasWidth = ref(500);
const canvasHeight = ref(300);

/** Graphical variables */
let scene: Scene;
let camera: OrthographicCamera;
let renderer: WebGLRenderer;
let groupRight: Group;
let groupLeft: Group;

// For rendering the scene if modified
let sceneModified = true;
let retry = 0;

/**
 * Ask if the scene needs rendering because has been changed,
 * then reset the modified flag
 *
 * @returns True if the scene should be rendered
 */
const needRendering = (): boolean => {

    if(sceneModified) {
        if(retry > 2) {
            sceneModified = false;
            retry = 0;
        }
        ++retry;
        return true;
    }
    return false;
};

/**
 * Initialize the viewer
 */
const initViewer = (): void => {

    if(!cnv.value) return;

    scene = new Scene();
    scene.background = new Color("#90CEEC");

    const hh = 7.8;
    const hw = hh * canvasWidth.value/canvasHeight.value;
    camera = new OrthographicCamera(-hw, hw, hh, -hh, 0.1, 500);
    camera.position.set(7.7, 8.5, 7.6);
    camera.lookAt(scene.position);
    camera.zoom = 1;

    renderer = new WebGLRenderer({antialias: true, powerPreference: "high-performance"});
    renderer.setSize(canvasWidth.value, canvasHeight.value);
    document.body.append(renderer.domElement);
    cnv.value.append(renderer.domElement);

    // Add mouse controls to move the camera
    const subsetOfTHREE = {OrthographicCamera, Vector3, Vector2, WebGLRenderer,
                           Raycaster, Vector4, Quaternion, Matrix4, Spherical,
                           Box3, Sphere, MathUtils};
    CameraControls.install({THREE: subsetOfTHREE});
    const controls = new CameraControls(camera, renderer.domElement);

    const light = new DirectionalLight("white", 3);
    light.position.set(0, 1, 0);
    scene.add(light);
    const ambient = new AmbientLight("#BBBBBB", 1);
    scene.add(ambient);

    groupLeft = new Group();
    scene.add(groupLeft);
    groupRight = new Group();
    scene.add(groupRight);

    // Rendering function for the run
    const clock = new Clock();
    const animationLoop = (): void => {

        const doRender = controls.update(clock.getDelta());
        if(doRender || needRendering()) {

            light.position.copy(camera.position);
            renderer.render(scene, camera);
        }
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

        const hh = 7.8;
        const hw = hh * canvasWidth.value/canvasHeight.value;
        camera.left   = -hw;
        camera.right  =  hw;
        camera.top    =  hh;
        camera.bottom = -hh;

        camera.updateProjectionMatrix();
        renderer.setSize(canvasWidth.value, canvasHeight.value);
        sceneModified = true;
    });

    // Get the canvas size
    const canvas = document.querySelector<HTMLDivElement>(".side-n");
    if(!canvas) return;
    resizeObserver.observe(canvas);

    initViewer();
});

const colors = [
    "blue",
    "green"
];
const indices = [

    4, 5, 1,
    4, 1, 0,

    3, 2, 6,
    3, 6, 7,

    4, 0, 3,
    4, 3, 7,

    1, 5, 6,
    1, 6, 2,
];

/**
 * Compute unit cell vertices coordinates
 *
 * @param basis - Basis vectors
 * @returns - List of vertices coordinates (bottom then top)
 */
 const computeCellVertices = (basis: BasisType): number[] => [
	0,                          0,                          0,
	basis[0],                   basis[1],                   basis[2],
	basis[0]+basis[3],          basis[1]+basis[4],          basis[2]+basis[5],
	basis[3],                   basis[4],                   basis[5],
	basis[6],                   basis[7],                   basis[8],
	basis[0]+basis[6],          basis[1]+basis[7],          basis[2]+basis[8],
	basis[0]+basis[3]+basis[6], basis[1]+basis[4]+basis[7], basis[2]+basis[5]+basis[8],
	basis[3]+basis[6],          basis[4]+basis[7],          basis[5]+basis[8],
];

/**
 * Draw the unit cell
 *
 * @param basis - The basis for the unit cell
 * @param side - Side of the related structure
 */
const drawUnitCell = (basis: BasisType, side: Side): void => {

    const material = new LineBasicMaterial({color: colors[side]});

    const geometry = new BufferGeometry();
    geometry.setIndex(indices);
    const vertices = computeCellVertices(basis);
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    const edges = new EdgesGeometry(geometry);

    const line = new LineSegments(edges, material);

    if(side) groupRight.add(line);
    else     groupLeft.add(line);
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
        const len = Math.hypot(dx, dy, dz);

        const geometry = new CylinderGeometry(0.1, 0.1, len, 10, 1, true);

        const meshMaterial = new MeshStandardMaterial({
            color: colors[side],
            roughness: 0.5,
            metalness: 0.6,
            side: FrontSide,
        });

        const cylinder = new Mesh(geometry, meshMaterial);

		// Rotate it along the bond direction
		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx/len, dy/len, dz/len));

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

            drawUnitCell(bb, side);
            drawAtoms(response.positions as number[], response.radii as number[], side);
            drawBonds(response.positions as number[], response.bonds as number[], side);

            if(side === 0) {
                na = new Vector3(bb[0], bb[1], bb[2]).normalize();
                nb = new Vector3(bb[3], bb[4], bb[5]).normalize();
                nc = new Vector3(bb[6], bb[7], bb[8]).normalize();
            }
            sceneModified = true;
        })
        .catch((error: Error) => {
            log.error(error);
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
    sceneModified = true;
};

/**
 * Send the updated selected steps list
 */
const updateSelection = (): void => {

    const steps = [];
    for(const entry of lines.value) steps.push(entry.step);
    sendToNode("SYSTEM", "updated-selection", {updatedStepsSelection: steps});
};

// Load values from main
receiveInWindow((dataFromMain) => {

    const steps = JSON.parse(dataFromMain) as number[];
    const len = steps.length;
    lines.value.length = 0;
    if(len === 0) return;
    for(let i=0; i < len; ++i) lines.value.push({
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

    const len = lines.value.length;
    for(let idx=0; idx < len; ++idx) {
        if(lines.value[idx].step === step) return idx;
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
        for(const entry of lines.value) entry.disabled1 = false;
        if(idx !== undefined) lines.value[idx].disabled1 = true;
    }
    else {
        for(const entry of lines.value) entry.disabled0 = false;
        if(idx !== undefined) lines.value[idx].disabled0 = true;
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
            lines.value[idx].selected1 = false;
            selectedStep1.value = -1;
            unloadStructure(1);
            enableAllExcept(0);
        }
        else if(selectedStep1.value === -1) {
            lines.value[idx].selected1 = true;
            selectedStep1.value = step;
            loadStructure(1, step);
            enableAllExcept(0, idx);
        }
        else {
            const idx1 = findIdx(selectedStep1.value);
            lines.value[idx1].selected1 = false;
            unloadStructure(1);
            lines.value[idx].selected1 = true;
            selectedStep1.value = step;
            loadStructure(1, step);
            enableAllExcept(0, idx);
        }
    }
    else {
        if(step === selectedStep1.value) return;
        if(step === selectedStep0.value) {
            lines.value[idx].selected0 = false;
            selectedStep0.value = -1;
            unloadStructure(0);
            enableAllExcept(1);
        }
        else if(selectedStep0.value === -1) {
            lines.value[idx].selected0 = true;
            selectedStep0.value = step;
            loadStructure(0, step);
            enableAllExcept(1, idx);
        }
        else {
            const idx0 = findIdx(selectedStep0.value);
            lines.value[idx0].selected0 = false;
            unloadStructure(0);
            lines.value[idx].selected0 = true;
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
    lines.value.splice(idx, 1);
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
    sceneModified = true;
});

</script>


<template>
<v-app :theme="theme">
  <div class="compare-grid">
    <div class="side-w px-2">
      <v-label class="sub-tt separator-title first-title">Compare selected</v-label>
      <div class="sub-tl"></div>
      <div class="sub-tr"></div>
      <div class="sub-cl">
        <div v-for="line of lines" :key="line.step"
             class="entry" :class="{selected: line.selected0, disabled: line.disabled0}"
             @click="select(0, line.step)">{{ line.step }}</div>
      </div>
      <div class="sub-cr">
        <div v-for="line of lines" :key="line.step"
             class="entry" :class="{selected: line.selected1, disabled: line.disabled1}"
             @click="select(1, line.step)">{{ line.step }}</div>
      </div>
      <v-btn class="sub-bl" :disabled="selectedStep0 === -1" @click="remove(0)">Remove</v-btn>
      <v-btn class="sub-br" :disabled="selectedStep1 === -1" @click="remove(1)">Remove</v-btn>
    </div>
    <div class="side-n" ref="viewCompare">
    </div>
    <div class="side-s">
      <g-slider-with-steppers v-model="aroundA"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      v-model:raw="showAroundA" label-width="7.4rem"
                      :label="`Around: a (${showAroundA}°)`"
                      :min="-180" :max="180" :step="1" />
      <g-slider-with-steppers v-model="aroundB"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      v-model:raw="showAroundB" label-width="4rem"
                      :label="`b (${showAroundB}°)`"
                      :min="-180" :max="180" :step="1" />
      <g-slider-with-steppers v-model="aroundC"
                      :disabled="selectedStep0 === -1 || selectedStep1 === -1"
                      v-model:raw="showAroundC" label-width="4rem"
                      :label="`c (${showAroundC}°)`"
                      :min="-180" :max="180" :step="1" />
      <v-btn v-focus @click="resetRotations"
             :disabled="selectedStep0 === -1 || selectedStep1 === -1">Reset</v-btn>
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
  color: light-dark(rgba(16, 16, 16, 0.3), rgba(255, 255, 255, 0.3));
}

.entry {
  cursor: pointer;
  text-align-last: right;
}
</style>
