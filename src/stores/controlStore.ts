/**
 * Global control variables not saved as status.
 *
 * @packageDocumentation
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
	} as GlobalControls),

    // > Actions
    actions: {
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
        deselectAtoms() {
            this.atomsSelected.length = 0;
        }
    }});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot));
}
