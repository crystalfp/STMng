<script setup lang="ts">
/**
 * @component
 * Viewer for the aflow prototype structures.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-01
 */
import {ref} from "vue";
import {inv} from "mathjs";
import {IcosahedronGeometry, Vector3,
		CylinderGeometry, MeshStandardMaterial, FrontSide, Group, Color,
		Mesh, LineSegments, LineBasicMaterial} from "three";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, requestData} from "@/services/RoutesClient";
import {SimpleViewer} from "@/services/SimpleViewer";
import {/* addOutsideAtoms, clearOutsideAtoms, */ computeBonds} from "@/services/BondsSupport";
import {spriteText, disposeTextInGroup} from "@/services/SpriteText";
import {colorTextureMaterial} from "@/services/HelperMaterials";
import {computeCellEdges} from "@/services/ComputeCellEdges";
import type {PositionType, PrototypeAtomsData, Bond, CtrlParams} from "@/types";

const windowPath = "/prototype";

const roughness = 0.5;
const metalness = 0.6;

const prototypeName = ref("");

// Kind of directions for filling the unit cell
const X_MIN = 0x010;
const Y_MIN = 0x020;
const Z_MIN = 0x040;
const X_MAX = 0x100;
const Y_MAX = 0x200;
const Z_MAX = 0x400;
const X_ANY = 0x001;
const Y_ANY = 0x002;
const Z_ANY = 0x004;

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

/** Receive the prototype data from the main window */
requestData(windowPath, (params: CtrlParams) => {

    const atoms = JSON.parse(params.atoms as string ?? "[]") as PrototypeAtomsData;
    const matrix = params.matrix as number[] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const mineral = params.mineral as string ?? "";
    const aflow = params.aflow as string ?? "";
    const pearson = params.pearson as string ?? "";
    const strukturbericht = params.strukturbericht as string ?? "";

    const uc = computeLatticeVertices(matrix);
    const center = addUnitCell(uc);

    const {bonds, atoms: fullAtoms} = addAtoms(atoms, matrix);

    addLabels(fullAtoms);

    addBonds(fullAtoms, bonds);

    sv.centerCamera(center);
    sv.rotateCamera(0);

    sv.setSceneModified();

    const sb = strukturbericht.replace(/_([^_]+)$/, "<sub>$1</sub>");
    prototypeName.value = `${mineral}&ensp;(aflow: ${aflow},&ensp;`+
                          `strukturbericht: ${sb},&ensp;pearson: ${pearson})`;
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
const addUnitCell = (vertices: number[]): [number, number, number] => {

    sv.clearGroup("UnitCell");

    const edges = computeCellEdges(vertices);
    const line = new LineSegments(edges, new LineBasicMaterial({color: "#0000FF"}));
    cellGroup.add(line);

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

	const direction = Array<number>(natoms).fill(0);
    const idx: number[] = Array<number>(natoms);
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

        // Mark atoms exactly on the border
        if(xf < MARGIN && xf > -MARGIN)			direction[i]  = X_MIN|X_ANY;
        else if(xf > 1-MARGIN && xf < 1+MARGIN)	direction[i]  = X_MAX|X_ANY;
        if(yf < MARGIN && yf > -MARGIN)			direction[i] |= Y_MIN|Y_ANY;
        else if(yf > 1-MARGIN && yf < 1+MARGIN)	direction[i] |= Y_MAX|Y_ANY;
        if(zf < MARGIN && zf > -MARGIN)			direction[i] |= Z_MIN|Z_ANY;
        else if(zf > 1-MARGIN && zf < 1+MARGIN)	direction[i] |= Z_MAX|Z_ANY;

        idx[i] = i;
    }

    if(direction.every((value) => value === 0)) return structuredClone(atoms);

    // Replicate the original atoms
    for(let i=0; i < natoms; ++i) {

        const dir = direction[i];
        const k = 3*i;

        if(dir === 0) continue;

        switch(dir & (X_ANY|Y_ANY|Z_ANY)) {

        case X_ANY:
            fc.push(dir & X_MIN ? 1 : 0, fc[k+1], fc[k+2]);
            idx.push(i);
            break;

        case Y_ANY:
            fc.push(fc[k], dir & Y_MIN ? 1 : 0, fc[k+2]);
            idx.push(i);
            break;

        case Z_ANY:
            fc.push(fc[k], fc[k+1], dir & Z_MIN ? 1 : 0);
            idx.push(i);
            break;

        case X_ANY|Y_ANY:
            if((dir & (X_MIN|Y_MIN)) !== (X_MIN|Y_MIN)) {
                fc.push(0, 0, fc[k+2]);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MIN)) !== (X_MAX|Y_MIN)) {
                fc.push(1, 0, fc[k+2]);
                idx.push(i);
            }
            if((dir & (X_MIN|Y_MAX)) !== (X_MIN|Y_MAX)) {
                fc.push(0, 1, fc[k+2]);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MAX)) !== (X_MAX|Y_MAX)) {
                fc.push(1, 1, fc[k+2]);
                idx.push(i);
            }
            break;

        case X_ANY|Z_ANY:
            if((dir & (X_MIN|Z_MIN)) !== (X_MIN|Z_MIN)) {
                fc.push(0, fc[k+1], 0);
                idx.push(i);
            }
            if((dir & (X_MAX|Z_MIN)) !== (X_MAX|Z_MIN)) {
                fc.push(1, fc[k+1], 0);
                idx.push(i);
            }
            if((dir & (X_MIN|Z_MAX)) !== (X_MIN|Z_MAX)) {
                fc.push(0, fc[k+1], 1);
                idx.push(i);
            }
            if((dir & (X_MAX|Z_MAX)) !== (X_MAX|Z_MAX)) {
                fc.push(1, fc[k+1], 1);
                idx.push(i);
            }
            break;

        case Y_ANY|Z_ANY:
            if((dir & (Y_MIN|Z_MIN)) !== (Y_MIN|Z_MIN)) {
                fc.push(fc[k], 0, 0);
                idx.push(i);
            }
            if((dir & (Y_MAX|Z_MIN)) !== (Y_MAX|Z_MIN)) {
                fc.push(fc[k], 1, 0);
                idx.push(i);
            }
            if((dir & (Y_MIN|Z_MAX)) !== (Y_MIN|Z_MAX)) {
                fc.push(fc[k], 0, 1);
                idx.push(i);
            }
            if((dir & (Y_MAX|Z_MAX)) !== (Y_MAX|Z_MAX)) {
                fc.push(fc[k], 1, 1);
                idx.push(i);
            }
            break;

        case X_ANY|Y_ANY|Z_ANY:
            if((dir & (X_MIN|Y_MIN|Z_MIN)) !== (X_MIN|Y_MIN|Z_MIN)) {
                fc.push(0, 0, 0);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MIN|Z_MIN)) !== (X_MAX|Y_MIN|Z_MIN)) {
                fc.push(1, 0, 0);
                idx.push(i);
            }
            if((dir & (X_MIN|Y_MAX|Z_MIN)) !== (X_MIN|Y_MAX|Z_MIN)) {
                fc.push(0, 1, 0);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MAX|Z_MIN)) !== (X_MAX|Y_MAX|Z_MIN)) {
                fc.push(1, 1, 0);
                idx.push(i);
            }
            if((dir & (X_MIN|Y_MIN|Z_MAX)) !== (X_MIN|Y_MIN|Z_MAX)) {
                fc.push(0, 0, 1);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MIN|Z_MAX)) !== (X_MAX|Y_MIN|Z_MAX)) {
                fc.push(1, 0, 1);
                idx.push(i);
            }
            if((dir & (X_MIN|Y_MAX|Z_MAX)) !== (X_MIN|Y_MAX|Z_MAX)) {
                fc.push(0, 1, 1);
                idx.push(i);
            }
            if((dir & (X_MAX|Y_MAX|Z_MAX)) !== (X_MAX|Y_MAX|Z_MAX)) {
                fc.push(1, 1, 1);
                idx.push(i);
            }
            break;
        }
    }
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
        // const k = idx[i]*3;
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

    // const fullAtoms = addOutsideAtoms(matrix, atoms);
    // const bonds = computeBonds(fullAtoms);
    // clearOutsideAtoms(fullAtoms, bonds, atoms.radius.length);

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

    for(let i=0; i < nBonds; ++i) {

        const from = bonds[i].from;
        const to   = bonds[i].to;

        const colorFrom = atoms.color[from];
        const colorTo   = atoms.color[to];

        const dx = atoms.positions[3*to+0] - atoms.positions[3*from+0];
        const dy = atoms.positions[3*to+1] - atoms.positions[3*from+1];
        const dz = atoms.positions[3*to+2] - atoms.positions[3*from+2];
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
        const midx = (atoms.positions[3*to+0] + atoms.positions[3*from+0])/2;
        const midy = (atoms.positions[3*to+1] + atoms.positions[3*from+1])/2;
        const midz = (atoms.positions[3*to+2] + atoms.positions[3*from+2])/2;
		cylinder.position.set(midx, midy, midz);

		// Add to the scene
        bondsGroup.add(cylinder);
    }
};
</script>


<template>
<v-app :theme>
  <div class="prototype-portal">
    <div class="prototype-viewer" />
    <v-container class="prototype-buttons">
      <v-label v-html="prototypeName"/>
      <v-btn v-focus @click="closeWindow(windowPath)">Close</v-btn>
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

.prototype-buttons {
  display: flex;
  max-width: 3000px !important;
  width: 100vw;
  gap: 10px;
  justify-content: space-between;
  align-items: baseline
}

:deep(sub) {
  position: relative;
  bottom: -0.5rem;
}
</style>
