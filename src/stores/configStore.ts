/**
 * The shared state of the viewer.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "@/types";

interface Viewer3DConfiguration {

    camera: {
        type: "perspective" | "orthographic";
        position: PositionType;
        lookAt: PositionType;
        snapshotFormat: string;
        stlFormat: "ascii" | "binary";
    };
    scene: {
        background: string;
    };
    lights: {
        ambientColor: string;
        ambientIntensity: number;
        directional1Color: string;
        directional1Intensity: number;
        directional1Position: PositionType;
        directional2Color: string;
        directional2Intensity: number;
        directional2Position: PositionType;
        directional3Color: string;
        directional3Intensity: number;
        directional3Position: PositionType;
    };
    helpers: {
        showAxis: boolean;
        showGridXZ: boolean;
        showGridXY: boolean;
        showGridYZ: boolean;
        gridSize: number;
        axisLength: number;
    };
    control: {
        reset: boolean;
        snapshot: boolean;
        movie: boolean;
        stl: boolean;
        sceneCenter: PositionType;
        sceneSides: PositionType;
        atomsSelected: number[];
        hasFingerprints: boolean;
        fingerprintsAccumulate: boolean;
    };
}


export const useConfigStore = defineStore("ConfigStore", {

    state: () => ({

		camera: {
			type: "orthographic",
            position: [5, 3, 5],
            lookAt: [0, 0, 0],
            snapshotFormat: "png",
            stlFormat: "binary",
		},
		scene: {
			background: "#90CEEC",
		},
		lights: {
			ambientColor: "#FFFFFF",
			ambientIntensity: 0.5,
			directional1Color: "#FFFFFF",
			directional1Intensity: 1.5,
			directional2Color: "#FFFFFF",
			directional2Intensity: 1.5,
			directional3Color: "#FFFFFF",
			directional3Intensity: 1.5,
			directional1Position: [0, 1, 0],
			directional2Position: [0.5774, 0.5774, 0.5774],
			directional3Position: [-0.5774, -0.5774, -0.5774],
		},
        helpers: {
            showAxis: false,
            showGridXZ: false,
            showGridXY: false,
            showGridYZ: false,
            gridSize: 10,
            axisLength: 1,
        },
        control: {
            reset: false,
            snapshot: false,
            movie: false,
            stl: false,
            sceneCenter: [0, 0, 0],
            sceneSides: [1, 1, 1],
            atomsSelected: [],
            hasFingerprints: false,
            fingerprintsAccumulate: false,
        }
	} as Viewer3DConfiguration),

    // > Getters
    getters: {
        statusToSave(state: Viewer3DConfiguration) {
            const statusToSave = {
                camera: state.camera,
                scene: state.scene,
                lights: state.lights,
                helpers: state.helpers,
            };
            return JSON.stringify(statusToSave);
        }
    },

    // > Actions
    actions: {
        addSelectedAtom(index: number) {

            // If index already there remove it
            const existing = this.control.atomsSelected.indexOf(index);
            if(existing >= 0) {
                this.control.atomsSelected.splice(existing, 1);
            }
            else if(this.control.atomsSelected.length < 3) {
                this.control.atomsSelected.push(index);
            }
            else {
                this.control.atomsSelected[0] = this.control.atomsSelected[1];
                this.control.atomsSelected[1] = this.control.atomsSelected[2];
                this.control.atomsSelected[2] = index;
            }
        },
        deselectAtoms() {
            this.control.atomsSelected.length = 0;
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
