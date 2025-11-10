<script setup lang="ts">
/**
 * @component
 * Viewer for the aflow prototype structures.
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-01
 */
import {ref} from "vue";
import {BufferGeometry, BufferAttribute, IcosahedronGeometry, Vector3,
		CylinderGeometry, MeshStandardMaterial, FrontSide, Group, Color,
		Mesh, EdgesGeometry, LineSegments, LineBasicMaterial} from "three";
import {theme} from "@/services/ReceiveTheme";
import {handleSpecialKeys} from "@/services/HandleSpecialKeys";
import {closeWindow, receiveInWindow} from "@/services/RoutesClient";
import {SimpleViewer} from "@/services/SimpleViewer";
import {addOutsideAtoms, clearOutsideAtoms, computeBonds} from "@/services/BondsSupport";
import type {PositionType, PrototypeAtomsData, PrototypeStructureData, Bond} from "@/types";
import {indices} from "@/services/SharedConstants";
import {spriteText, disposeTextInGroup} from "@/services/SpriteText";
import {colorTextureMaterial} from "@/services/HelperMaterials";

const roughness = 0.5;
const metalness = 0.6;

const prototypeName = ref("");

/** The received data */
let prototypeStructureData: PrototypeStructureData | undefined;

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
receiveInWindow((dataFromMain) => {

    prototypeStructureData = JSON.parse(dataFromMain) as PrototypeStructureData;

    const {atoms, matrix, mineral, aflow} = prototypeStructureData;

    const uc = computeLatticeVertices(matrix);
    const center = addUnitCell(uc);

    const {bonds, atoms: fullAtoms} = addAtoms(atoms, matrix);

    addLabels(fullAtoms);

    addBonds(fullAtoms, bonds);

    sv.centerCamera(center);
    sv.rotateCamera(0);

    sv.setSceneModified();

    prototypeName.value = `${mineral} (aflow: ${aflow})`;
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
 * @param vertices - Vertices of the unit cell
 * @returns - Unit cell center coordinates
 */
const addUnitCell = (vertices: number[]): [number, number, number] => {

    sv.clearGroup("UnitCell");

    const geometry = new BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
    const edges = new EdgesGeometry(geometry);

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
 * Add atoms to the scene and compute bonds
 *
 * @param atoms - Prototype atom data
 * @param matrix - Lattice matrix
 * @returns List of computed bonds
 */
const addAtoms = (atoms: PrototypeAtomsData, matrix: number[][]): {bonds: Bond[]; atoms: PrototypeAtomsData} => {

    sv.clearGroup("Atoms");

    const fullAtoms = addOutsideAtoms(matrix, atoms);
    const bonds = computeBonds(fullAtoms);
    clearOutsideAtoms(fullAtoms, bonds, atoms.radius.length);

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

    for(let i=0; i < atoms.radius.length; ++i) {

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
<Suspense>
  <div class="prototype-portal">
    <div class="prototype-viewer" />
    <v-container class="prototype-buttons">
      <v-label>{{ prototypeName }}</v-label>
      <v-btn v-focus @click="closeWindow('/prototype')">Close</v-btn>
    </v-container>
  </div>
</Suspense>
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
</style>
