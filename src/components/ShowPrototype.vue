<script setup lang="ts">
/**
 * @component
 * Viewer for the aflow prototype and collection structures.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-01
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {ref} from "vue";
import {inv} from "mathjs";
import {IcosahedronGeometry, Vector3,
		CylinderGeometry, MeshStandardMaterial, FrontSide, Group, Color,
		Mesh, LineSegments, LineBasicMaterial, Box3} from "three";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {SimpleViewer} from "@/services/SimpleViewer";
import {computeBonds} from "@/services/BondsSupport";
import {spriteText, disposeTextInGroup} from "@/services/SpriteText";
import {colorTextureMaterial} from "@/services/HelperMaterials";
import {computeCellEdges} from "@/services/ComputeCellEdges";
import {replicateAtoms} from "@/electron/modules/ReplicateAtoms";
import type {PositionType, PrototypeAtomsData, Bond, CtrlParams} from "@/types";

const windowPath = "/prototype";

const roughness = 0.5;
const metalness = 0.6;

const prototypeName = ref("");

/** Initialize the 3D viewer */
const labelsGroup = new Group();
const atomsGroup = new Group();
const cellGroup = new Group();
const bondsGroup = new Group();

const sv = new SimpleViewer(".prototype-viewer", false, (scene) => {

    labelsGroup.name = "AtomLabels";
    scene.add(labelsGroup);
    atomsGroup.name = "Atoms";
    scene.add(atomsGroup);
    cellGroup.name = "UnitCell";
    scene.add(cellGroup);
    bondsGroup.name = "Bonds";
    scene.add(bondsGroup);
});

const re = /_([^_]+)$/u;

/** Receive the prototype data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    const atomsRaw = params.atoms as string;
    if(!atomsRaw) return;
    const atoms = JSON.parse(atomsRaw) as PrototypeAtomsData;
    const matrix = params.matrix as number[] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const mineral = params.mineral as string ?? "";
    const aflow = params.aflow as string ?? "";
    const pearson = params.pearson as string ?? "";
    const strukturbericht = params.strukturbericht as string ?? "";

    const uc = computeLatticeVertices(matrix);
    void addUnitCell(uc);

    const {bonds, atoms: fullAtoms} = addAtoms(atoms, matrix);

    addLabels(fullAtoms);

    addBonds(fullAtoms, bonds);

    sv.positionCamera(atomsGroup);

    sv.setSceneModified();

    if(aflow || pearson || strukturbericht) {
        const pe = pearson ? `,&ensp;pearson: ${pearson}` : "";
        const sb = strukturbericht ? `,&ensp;strukturbericht: ${strukturbericht.replace(re, "<sub>$1</sub>")}` : "";
        prototypeName.value = `${mineral}&ensp;(aflow: ${aflow}${sb}${pe})`;
    }
    else {
        prototypeName.value = mineral;
    }
});

/** Capture and handle special keys (Escape, F1, F12) */
handleSpecialKeys(windowPath);

/**
 * Compute unit cell vertices coordinates
 * Ordered: (below) 0-1-2-3 (above) 4-5-6-7
 *
 * @param matrix - Pymatgen lattice matrix (flattened)
 * @returns - List of vertices coordinates (bottom then top)
 */
const computeLatticeVertices = (matrix: number[]): number[] => [
	0,                     0,                     0,
	matrix[0],             matrix[1],             matrix[2],
	matrix[0]+matrix[3],   matrix[1]+matrix[4],   matrix[2]+matrix[5],
	matrix[3],             matrix[4],             matrix[5],
	matrix[6],             matrix[7],             matrix[8],
	matrix[0]+matrix[6],   matrix[1]+matrix[7],   matrix[2]+matrix[8],
	matrix[0]+matrix[3]+matrix[6], matrix[1]+matrix[4]+matrix[7],
                                   matrix[2]+matrix[5]+matrix[8],
	matrix[3]+matrix[6],   matrix[4]+matrix[7],   matrix[5]+matrix[8]
];

/**
 * Draw the unit cell
 *
 * @param vertices - Vertices of the unit cell
 * @returns - Unit cell center coordinates
 */
const addUnitCell = (vertices: number[]): [x: number, y: number, z: number] => {

    sv.clearGroup("UnitCell");

    const edges = computeCellEdges(vertices);
    const line = new LineSegments(edges, new LineBasicMaterial({color: "#0000FF"}));
    cellGroup.add(line);

    // Compute the center of the unit cell
    const center: [x: number, y: number, z: number] = [0, 0, 0];
    for(let i=0; i < 24; i+=3) {
        for(let j=0; j < 3; ++j) {
            center[j] += vertices[i+j];
        }
    }
    for(let j=0; j < 3; ++j) center[j] /= 8;

    return center;
};

/**
 * Fill the unit cell with the replica on the sides
 *
 * @param atoms - Prototype atom data
 * @param matrix - Lattice matrix
 */
const fillCell = (atoms: PrototypeAtomsData, matrix: number[][]): PrototypeAtomsData => {

    const natoms = atoms.radius.length;

    const MARGIN = 1e-5;

    const inverse = inv(matrix);

    const fc: number[] = Array<number>(natoms*3);
    for(let i=0; i < natoms; ++i) {

        const i3 = 3*i;
		const cx = atoms.positions[i3];
		const cy = atoms.positions[i3+1];
		const cz = atoms.positions[i3+2];

		const xf = cx*inverse[0][0] + cy*inverse[1][0] + cz*inverse[2][0];
		const yf = cx*inverse[0][1] + cy*inverse[1][1] + cz*inverse[2][1];
		const zf = cx*inverse[0][2] + cy*inverse[1][2] + cz*inverse[2][2];

        fc[i3]   = xf;
        fc[i3+1] = yf;
        fc[i3+2] = zf;
    }

    const idx = replicateAtoms(fc, MARGIN);
    if(idx.length === 0) return structuredClone(atoms);

    // Finish building the structure
    const nOutAtoms = fc.length / 3;
    const outAtoms: PrototypeAtomsData = {
        positions: [],
        labels: [],
        radius: [],
        color: []
    };
    for(let i=0; i < nOutAtoms; ++i) {

        const k = i*3;
		const fx = fc[k];
		const fy = fc[k+1];
		const fz = fc[k+2];

		outAtoms.positions.push(
			fx*matrix[0][0] + fy*matrix[1][0] + fz*matrix[2][0],
			fx*matrix[0][1] + fy*matrix[1][1] + fz*matrix[2][1],
			fx*matrix[0][2] + fy*matrix[1][2] + fz*matrix[2][2]
        );
        outAtoms.labels.push(atoms.labels[idx[i]]);
        outAtoms.radius.push(atoms.radius[idx[i]]);
        outAtoms.color.push(atoms.color[idx[i]]);
    }

    return outAtoms;
};

/**
 * Add atoms to the scene and compute bonds
 *
 * @param atoms - Prototype atom data
 * @param matrix - Lattice matrix
 * @returns List of computed bonds
 */
const addAtoms = (atoms: PrototypeAtomsData, matrix: number[]): {bonds: Bond[]; atoms: PrototypeAtomsData} => {

    sv.clearGroup("Atoms");

    // Rebuild matrix from flattened matrix
    const m = [
        [matrix[0], matrix[1], matrix[2]],
        [matrix[3], matrix[4], matrix[5]],
        [matrix[6], matrix[7], matrix[8]],
    ];
    const fullAtoms = fillCell(atoms, m);
    const bonds = computeBonds(fullAtoms);

    const natoms = fullAtoms.radius.length;
    for(let i = 0; i < natoms; ++i) {
        const meshMaterial = new MeshStandardMaterial({
            color: fullAtoms.color[i],
            roughness,
            metalness,
            side: FrontSide,
        });
        meshMaterial.color.convertSRGBToLinear();

        const geometry = new IcosahedronGeometry(fullAtoms.radius[i]*0.5, 9);

        const sphere = new Mesh(geometry, meshMaterial);
        sphere.position.set(fullAtoms.positions[3*i], fullAtoms.positions[3*i+1], fullAtoms.positions[3*i+2]);
        atomsGroup.add(sphere);
    }

    return {bonds, atoms: fullAtoms};
};

/**
 * Add atoms labels
 *
 * @param atoms - Prototype atom data
 */
const addLabels = (atoms: PrototypeAtomsData): void => {

    // Remove existing labels
    disposeTextInGroup(labelsGroup);

    const len = atoms.radius.length;
    for(let i=0; i < len; ++i) {

        const offset = atoms.radius[i] * 0.65;
	    const labelPosition: PositionType = [
            atoms.positions[3*i+0],
            atoms.positions[3*i+1],
            atoms.positions[3*i+2]+offset
        ];
        const labelText = atoms.labels[i];
		const atomLabel = spriteText(labelText, "#FFFFFF", 0.4, labelPosition);

		labelsGroup.add(atomLabel);
    }
};

/**
 * Draw the bonds
 *
 * @param atomsPosition - Positions of the atoms
 * @param bonds - List of bonds
 */
const addBonds = (atoms: PrototypeAtomsData, bonds: Bond[]): void => {

    sv.clearGroup("Bonds");

    const nBonds = bonds.length;
    const {positions, color} = atoms;

    for(let i=0; i < nBonds; ++i) {

        const {from, to} = bonds[i];
        const from3 = 3*from;
        const to3   = 3*to;

        const colorFrom = color[from];
        const colorTo   = color[to];

        const dx = positions[to3]   - positions[from3];
        const dy = positions[to3+1] - positions[from3+1];
        const dz = positions[to3+2] - positions[from3+2];
        const len = Math.hypot(dx, dy, dz);

        const geometry = new CylinderGeometry(0.1, 0.1, len, 10, 1, true);

        const meshMaterial = colorTextureMaterial(new Color(colorFrom),
                                                  new Color(colorTo),
                                                  roughness,
                                                  metalness,
                                                  16,
                                                  false);

        const cylinder = new Mesh(geometry, meshMaterial);

		// Rotate it along the bond direction
		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0),
                                               new Vector3(dx/len, dy/len, dz/len));

		// Move it to the midpoint between atoms
        const midx = (positions[to3]   + positions[from3])/2;
        const midy = (positions[to3+1] + positions[from3+1])/2;
        const midz = (positions[to3+2] + positions[from3+2])/2;
		cylinder.position.set(midx, midy, midz);

		// Add to the scene
        bondsGroup.add(cylinder);
    }
};

/**
 * Center the structure in the viewer
 */
const centerView = (): void => {

    const bbox = new Box3();
    bbox.setFromObject(atomsGroup);
    const center = new Vector3();
    bbox.getCenter(center);
    sv.centerCamera(center.toArray());
};

</script>


<template>
<v-app :theme class="layout-app">
    <div class="layout-main prototype-viewer" />
    <v-container class="layout-buttons" style="justify-content: space-between">
      <v-label v-html="prototypeName"/>
      <div class="d-flex ga-2 justify-end">
        <v-btn @click="centerView">Center</v-btn>
        <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
      </div>
    </v-container>
</v-app>
</template>


<style scoped>

:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}
</style>
