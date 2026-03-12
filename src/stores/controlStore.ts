/**
 * Global control variables not saved as status.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "@/types";
import type {BoundingSphere} from "@/services/BoundingSphere";

/**
 * Store content: controls accessed by more than one node
 * @notExported
 */
interface GlobalControls {

	/** Reset camera */
	reset: boolean;
	/** Scene center */
	sceneCenter: PositionType;
	/** Scene bounding sphere radius */
	sceneRadius: number;
	/** The unit cell is visible and should be considered in bounding sphere computation */
	sceneUnitCell: boolean;

	/** Forced camera view direction */
	viewDirection: string;
	/** Cell basis */
	basis: number[];

	/** Force camera position */
	force: boolean;

	/** Capture a viewer snapshot */
	snapshot: boolean;
	/** Capture a movie */
	movie: boolean;
	/** Capture a STL file */
	stl: boolean;
	/** STL file scale */
	stlScale: number;

	/** Capture for fingerprinting */
	fingerprintsAccumulate: boolean;
	/** Capture for trajectory recording */
	trajectoriesRecording: boolean;
	/** Atoms selector has been set */
	trajectoriesHasSelector: boolean;
	/** Capture for writer of multistep structures */
	writerAccumulate: boolean;
	/** Capture for variable composition analysis */
	variableCompositionAccumulate: boolean;

	/** Set if capture node is present to add its control in StructureReader */
	hasCapture: boolean;
	/** Set if the trajectory node is present to add its control in StructureReader */
	hasTrajectory: boolean;
	/** Set if fingerprinting node is present to add its control in StructureReader */
	hasFingerprints: boolean;
	/** Set if the writer node is present to add its control in StructureReader */
	hasWriter: boolean;
	/** Set if the variable composition module is present to add its control in StructureReader */
	hasVariableComposition: boolean;

	/** Atoms selection */
	atomsSelected: number[];
	/** To convert selected atom into instance index */
	selectedAtomMap: number[][];

	/** Polyhedra selection */
	polyhedronCurrentIdx: number | undefined;
	/** New polyhedra selected */
	polyhedronNewIdx: number | undefined;
	/** Polyhedra color */
	polyhedronCurrentColor: number;
	/** Selected polyhedra color */
	polyhedronNewColor: number;

	/** Dragging file from outside */
	draggingFile: boolean;

	/** Legend visible */
	legend: boolean;
	/** Values to have a discrete values legend */
	legendDiscrete: {
		/** Color of the discrete point */
		color: string;
		/** Label for the point */
		label: string;
	}[];
}

/** Access the control store that contains global control variables not saved as status */
export const useControlStore = defineStore("ControlStore", {

    state: () => ({
		reset: false,
		sceneCenter: [0, 0, 0],
		sceneRadius: 1,
		sceneUnitCell: true,

		viewDirection: "",
		basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],

		force: false,

		snapshot: false,
		movie: false,
		stl: false,
		stlScale: 1,

		fingerprintsAccumulate: false,
		trajectoriesRecording: false,
		trajectoriesHasSelector: false,
		writerAccumulate: false,
		variableCompositionAccumulate: false,

		hasCapture: false,
		hasFingerprints: false,
		hasTrajectory: false,
		hasWriter: false,
		hasVariableComposition: false,

		atomsSelected: [],
		selectedAtomMap: [],
		polyhedronCurrentIdx: undefined,
		polyhedronNewIdx: undefined,
		polyhedronCurrentColor: 0,
		polyhedronNewColor: 0,

		draggingFile: false,

		legend: false,
		legendDiscrete: []

	} as GlobalControls),

    // > Actions
    actions: {
		/**
		 * Interactively select a polyhedron
		 *
		 * @param index - Index of the selected polyhedron
		 * @param color - Original color of the selected polyhedron
		 */
		selectPolyhedron(index: number, color: number): void {

			this.polyhedronNewIdx = index;
			this.polyhedronNewColor = color;
		},
		/**
		 * Deselect the selected polyhedron
		 */
		deselectPolyhedron(): void {
			this.polyhedronNewIdx = this.polyhedronCurrentIdx;
		},
		/**
		 * Deselect the selected polyhedron and atoms
		 */
		deselectAll(): void {

			// Deselect atoms
            this.atomsSelected.length = 0;

			// Deselect polyhedra
			this.polyhedronNewIdx = this.polyhedronCurrentIdx;
		},
		/**
		 * Reset capability indicator (the has* variables)
		 */
		resetCapabilityIndicators(): void {

			this.hasCapture = false;
			this.hasFingerprints = false;
			this.hasTrajectory = false;
			this.hasWriter = false;
		},
		/**
		 * Add an atom to the list of interactively selected atoms
		 *
		 * @param meshIndex - Index of the instantiated mesh
		 * @param instanceId - Index of the instantiation of this mesh
		 */
		addSelection(meshIndex: number, instanceId: number): void {

			const index = this.selectedAtomMap[meshIndex][instanceId];

			// If index already there remove it
            const existing = this.atomsSelected.indexOf(index);
            if(existing !== -1) {
                this.atomsSelected.splice(existing, 1);
            }
            else if(this.atomsSelected.length < 3) {
                this.atomsSelected.push(index);
            }
            else {
                this.atomsSelected[0] = this.atomsSelected[1];
                this.atomsSelected[1] = this.atomsSelected[2];
                this.atomsSelected[2] = index;
            }
		},
		/**
		 * Save mapping to atom index
		 *
		 * @param map - Map from the mesh index/instantiation idx pair to the atom index
		 */
		addSelectionMapping(map: number[][]): void {

			this.selectedAtomMap = map;
		},
		/**
		 * Set scene center and radius depending on the unit cell visibility
		 *
		 * @param boundingSphere - Scene bounding sphere
		 */
		setSceneCenterAndRadius(boundingSphere: BoundingSphere): void {

			if(this.sceneUnitCell) {
				this.sceneCenter = boundingSphere.centerUC;
				this.sceneRadius = boundingSphere.radiusUC;
			}
			else {
				this.sceneCenter = boundingSphere.center;
				this.sceneRadius = boundingSphere.radius;
			}
		}
    }
});

// > Support HMR during development
if(import.meta.hot) {
	/* oxlint-disable-next-line @typescript-eslint/strict-void-return */
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
