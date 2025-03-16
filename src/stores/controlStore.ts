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

/** Store content: controls accessed by more than one node */
interface GlobalControls {

	/** Reset camera */
	reset: boolean;
	/** Scene center */
	sceneCenter: PositionType;
	/** Scene sides */
	sceneSides: PositionType;

	/** Force camera position */
	force: boolean;

	/** Capture a viewer snapshot */
	snapshot: boolean;
	/** Capture a movie */
	movie: boolean;
	/** Capture a STL file */
	stl: boolean;

	/** Capture for multistep structures */
	fingerprintsAccumulate: boolean;
	trajectoriesRecording: boolean;
	writerAccumulate: boolean;

	/** Set if a functionality is present to add its control in StructureReader */
	hasCapture: boolean;
	hasTrajectory: boolean;
	hasFingerprints: boolean;
	hasWriter: boolean;

	/** Atoms/polyhedra selection */
	atomsSelected: number[];
	selectedAtomMap: number[][];
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
		selectedAtomMap: [],
		polyhedronCurrentIdx: undefined,
		polyhedronNewIdx: undefined,
		polyhedronCurrentColor: 0,
		polyhedronNewColor: 0,

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
		}
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
