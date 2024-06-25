/**
 * The shared state of the viewer.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
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
        }
	} as Viewer3DConfiguration),

    // > Getters
    getters: {
        /**
         * Return the status to be saved in a project
         *
         * @param state - The store state
         * @returns JSON formatted content of the store to be saved
         */
        statusToSave(state: Viewer3DConfiguration) {
            const statusToSave = {
                camera: state.camera,
                scene: state.scene,
                lights: state.lights,
                helpers: state.helpers,
            };
            return JSON.stringify(statusToSave);
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
