/**
 * The shared state of the viewer.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {PositionType} from "../types";

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
        },
        /**
         * Check if the camera is perspective
         *
         * @param state - The store state
         * @returns True if the camera is set to perspective
         */
        isPerspectiveCamera(state: Viewer3DConfiguration) {
            return state.camera.type === "perspective";
        }
    },

    // > Actions
    actions: {
        restoreState(rawState: string | undefined) {

            if(!rawState) return;
            const state = JSON.parse(rawState) as Viewer3DConfiguration;

            this.camera.type = state.camera.type;
            this.camera.position[0] = state.camera.position[0];
            this.camera.position[1] = state.camera.position[1];
            this.camera.position[2] = state.camera.position[2];
            this.camera.lookAt[0] = state.camera.lookAt[0];
            this.camera.lookAt[1] = state.camera.lookAt[1];
            this.camera.lookAt[2] = state.camera.lookAt[2];
            this.camera.snapshotFormat = state.camera.snapshotFormat;
            this.camera.stlFormat = state.camera.stlFormat;

            this.scene.background = state.scene.background;

            this.lights.ambientColor = state.lights.ambientColor;
            this.lights.ambientIntensity = state.lights.ambientIntensity;
            this.lights.directional1Color = state.lights.directional1Color;
            this.lights.directional1Intensity = state.lights.directional1Intensity;
            this.lights.directional2Color = state.lights.directional2Color;
            this.lights.directional2Intensity = state.lights.directional2Intensity;
            this.lights.directional3Color = state.lights.directional3Color;
            this.lights.directional3Intensity = state.lights.directional3Intensity;
            this.lights.directional1Position[0] = state.lights.directional1Position[0];
            this.lights.directional1Position[1] = state.lights.directional1Position[1];
            this.lights.directional1Position[2] = state.lights.directional1Position[2];
            this.lights.directional2Position[0] = state.lights.directional2Position[0];
            this.lights.directional2Position[1] = state.lights.directional2Position[1];
            this.lights.directional2Position[2] = state.lights.directional2Position[2];
            this.lights.directional3Position[0] = state.lights.directional3Position[0];
            this.lights.directional3Position[1] = state.lights.directional3Position[1];
            this.lights.directional3Position[2] = state.lights.directional3Position[2];

            this.helpers.showAxis = state.helpers.showAxis;
            this.helpers.showGridXZ = state.helpers.showGridXZ;
            this.helpers.showGridXY = state.helpers.showGridXY;
            this.helpers.showGridYZ = state.helpers.showGridYZ;
            this.helpers.gridSize = state.helpers.gridSize;
            this.helpers.axisLength = state.helpers.axisLength;
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
