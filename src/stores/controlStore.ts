/**
 * Global control variables not saved as status.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "@/types";

interface GlobalControls {

	/** Reset camera */
	reset: boolean;
	sceneCenter: PositionType;
	sceneSides: PositionType;

	/** Force camera position */
	force: boolean;

	/** Capture media controls */
	snapshot: boolean;
	movie: boolean | null;
	stl: boolean;

	/** Capture for multistep structures */
	fingerprintsAccumulate: boolean | null;
	trajectoriesRecording: boolean | null;
	writerAccumulate: boolean | null;

	/** Set if a functionality is present to add its control in StructureReader */
	hasCapture: boolean;
	hasTrajectory: boolean;
	hasFingerprints: boolean;
	hasWriter: boolean;

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

		force: false,

		snapshot: false,
		movie: false,
		stl: false,

		fingerprintsAccumulate: false,
		trajectoriesRecording: false,
		writerAccumulate: false,

		hasCapture: false,
		hasFingerprints: false,
		hasTrajectory: false,
		hasWriter: false,

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
        addSelectedAtom(index: number): void {

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
		}
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
