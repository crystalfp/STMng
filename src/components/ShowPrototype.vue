<script setup lang="ts">
/**
 * @component
 * Viewer for the aflow prototype structures.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-01
 */
// import {ref} from "vue";
import {Scene, BufferGeometry, BufferAttribute, IcosahedronGeometry,
		/* CylinderGeometry, */ MeshStandardMaterial, FrontSide,
		Mesh, EdgesGeometry, LineSegments, LineBasicMaterial} from "three";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {SimpleViewer} from "@/services/SimpleViewer";
import {addOutsideAtoms, clearOutsideAtoms, computeBonds} from "@/services/BondsSupport";
import type {PrototypeAtomsData, PrototypeStructureData} from "@/types";
import {indices} from "../services/SharedConstants";

const roughness = 0.5;
const metalness = 0.6;

/** The received data */
let prototypeStructureData: PrototypeStructureData | undefined;

/** Initialize the 3D viewer */
const sv = new SimpleViewer(".prototype-viewer", false);

/** Receive the chart data from the main window */
receiveInWindow((dataFromMain) => {

    prototypeStructureData = JSON.parse(dataFromMain) as PrototypeStructureData;

    const scene = sv.getScene();
    const uc = computeLatticeVertices(prototypeStructureData.matrix);
    const center = addUnitCell(scene, uc);

    addAtoms(scene, prototypeStructureData.atoms, prototypeStructureData.matrix);

    sv.setSceneModified();

    sv.centerCamera(center);
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys("/prototype");

/**
 * Compute unit cell vertices coordinates
 * Ordered: (below) 0-1-2-3 (above) 4-5-6-7
 *
 * @param matrix - Pymatgen lattice matrix
 * @returns - List of vertices coordinates (bottom then top)
 */
const computeLatticeVertices = (matrix: number[][]): number[] => [
	0,                           0,                           0,
	matrix[0][0],                matrix[0][1],                matrix[0][2],
	matrix[0][0]+matrix[1][0],   matrix[0][1]+matrix[1][1],   matrix[0][2]+matrix[1][2],
	matrix[1][0],                matrix[1][1],                matrix[1][2],
	matrix[2][0],                matrix[2][1],                matrix[2][2],
	matrix[0][0]+matrix[2][0],   matrix[0][1]+matrix[2][1],   matrix[0][2]+matrix[2][2],
	matrix[0][0]+matrix[1][0]+matrix[2][0], matrix[0][1]+matrix[1][1]+matrix[2][1],
											matrix[0][2]+matrix[1][2]+matrix[2][2],
	matrix[1][0]+matrix[2][0],   matrix[1][1]+matrix[2][1],   matrix[1][2]+matrix[2][2],
];

/**
 * Draw the unit cell
 *
 * @param scene - The 3D scene
 * @param vertices - Vertices of the unit cell
 * @returns - Unit cell center coordinates
 */
const addUnitCell = (scene: Scene, vertices: number[]): [number, number, number] => {

    const geometry = new BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    const edges = new EdgesGeometry(geometry);

    const line = new LineSegments(edges, new LineBasicMaterial({color: "#0000FF"}));
    scene.add(line);

    // Compute the center of the unit cell
    const center: [number, number, number] = [0, 0, 0];
    for(let i=0; i < 24; i+=3) {
        for(let j=0; j < 3; ++j) {
            center[j] += vertices[i+j];
        }
    }
    for(let j=0; j < 3; ++j) center[j] /= 8;

    return center;
};

const addAtoms = (scene: Scene, atoms: PrototypeAtomsData, matrix: number[][]): void => {

    const fullAtoms = addOutsideAtoms(matrix, atoms);
    const bonds = computeBonds(fullAtoms);
    clearOutsideAtoms(fullAtoms, bonds, atoms.radius.length);

    const natoms = atoms.radius.length;
    for(let i = 0; i < natoms; ++i) {
        const meshMaterial = new MeshStandardMaterial({
            color: atoms.color[i],
            roughness,
            metalness,
            side: FrontSide,
        });
        meshMaterial.color.convertSRGBToLinear();

        const geometry = new IcosahedronGeometry(atoms.radius[i]*0.5, 9);

        const sphere = new Mesh(geometry, meshMaterial);
        sphere.position.set(atoms.positions[3*i], atoms.positions[3*i+1], atoms.positions[3*i+2]);
        scene.add(sphere);
    }
};

</script>


<template>
<v-app :theme>
  <div class="prototype-portal">
    <div class="prototype-viewer" />
    <v-container class="button-strip">
      <v-btn v-focus class="mt-2" @click="closeWindow('/prototype')">Close</v-btn>
    </v-container>
  </div>
</v-app>

</template>


<style scoped>

.prototype-portal {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 1100px;
  padding: 0;
}

.prototype-viewer {
  overflow: hidden;
  width: 100vw;
  flex: 2;
  padding: 0;
}
</style>
