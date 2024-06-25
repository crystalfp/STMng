/**
 * Global control variables not saved as status.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "@/types";

interface GlobalControls {
	reset: boolean;
	snapshot: boolean;
	movie: boolean;
	stl: boolean;
	atomsSelected: number[];
	hasFingerprints: boolean;
	fingerprintsAccumulate: boolean;
	computedSpaceGroup: string;
	sceneCenter: PositionType;
	sceneSides: PositionType;
	hasTrajectory: boolean;
	trajectoriesRecording: boolean;
	polyhedronCurrentIdx: number | undefined;
	polyhedronNewIdx: number | undefined;
	polyhedronCurrentColor: number;
	polyhedronNewColor: number;
}

export const useControlStore = defineStore("ControlStore", {

    state: () => ({
		reset: false,
		snapshot: false,
		movie: false,
		stl: false,
		atomsSelected: [],
		hasFingerprints: false,
		fingerprintsAccumulate: false,
		computedSpaceGroup: "",
		sceneCenter: [0, 0, 0],
		sceneSides: [1, 1, 1],
		hasTrajectory: false,
		trajectoriesRecording: false,
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
		 * Empty the list of selected atoms
		 */
        deselectAtoms() {
            this.atomsSelected.length = 0;
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
		}
    }});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
