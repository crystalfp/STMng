/**
 * Global control variables not saved as status.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "../types";

interface GlobalControls {

	/** Reset camera */
	reset: boolean;
	sceneCenter: PositionType;
	sceneSides: PositionType;

	/** Capture media controls */
	snapshot: boolean;
	movie: boolean;
	stl: boolean;

	fingerprintsAccumulate: boolean;
	trajectoriesRecording: boolean;

	/** Functionalities present for adding control in StructureReader */
	hasCapture: boolean;
	hasTrajectory: boolean;
	hasFingerprints: boolean;

	/** Atoms/polyhedra selection */
	atomsSelected: number[];
	polyhedronCurrentIdx: number | undefined;
	polyhedronNewIdx: number | undefined;
	polyhedronCurrentColor: number;
	polyhedronNewColor: number;
}

export const useControlStore = defineStore("ControlStore", {

    state: () => ({
		reset: false,
		sceneCenter: [0, 0, 0],
		sceneSides: [1, 1, 1],

		snapshot: false,
		movie: false,
		stl: false,

		fingerprintsAccumulate: false,
		trajectoriesRecording: false,

		hasCapture: false,
		hasFingerprints: false,
		hasTrajectory: false,

		atomsSelected: [],
		polyhedronCurrentIdx: undefined,
		polyhedronNewIdx: undefined,
		polyhedronCurrentColor: 0,
		polyhedronNewColor: 0,

	} as GlobalControls),

    // > Actions
    actions: {
		/**
		 * Add an atom to the list of interactively selected atoms
		 *
		 * @param index - Index of the atom selected on the screen
		 */
        addSelectedAtom(index: number) {

            // If index already there remove it
            const existing = this.atomsSelected.indexOf(index);
            if(existing >= 0) {
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
		 * Interactively select a polyhedron
		 *
		 * @param index - Index of the selected polyhedron
		 * @param color - Original color of the selected polyhedron
		 */
		selectPolyhedron(index: number, color: number) {

			this.polyhedronNewIdx = index;
			this.polyhedronNewColor = color;
		},
		/**
		 * Deselect the selected polyhedron
		 */
		deselectPolyhedron() {
			this.polyhedronNewIdx = this.polyhedronCurrentIdx;
		},
		/**
		 * Deselect the selected polyhedron and atoms
		 */
		deselectAll() {

			// Deselect atoms
            this.atomsSelected.length = 0;

			// Deselect polyhedra
			this.polyhedronNewIdx = this.polyhedronCurrentIdx;
		}
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
