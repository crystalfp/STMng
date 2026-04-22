/**
 * The shared state of the viewer.
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
import type {Viewer3DState} from "@/types";

/** Access the configuration store that contains the shared state of the viewer */
export const useConfigStore = defineStore("ConfigStore", {

    state: (): Viewer3DState => ({

		camera: {
			type: "orthographic",
            position: [5, 3, 5],
            lookAt: [0, 0, 0],
            snapshotFormat: "png",
            snapshotTransparent: false,
            stlFormat: "binary",
            forcePosition: [5, 3, 5],
            forceLookAt: [0, 0, 0],
            autoReset: false,

		},
		scene: {
			background: "#90CEEC",
            depthCueing: false,
            depthNear: 10,
            depthFar: 50
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
            showGizmo: false
        }
	}),

    // > Getters
    getters: {
        /**
         * Return the status to be saved in a project
         *
         * @param state - The store state
         * @returns JSON formatted content of the store to be saved
         */
        statusToSave(state: Viewer3DState): string {
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
        isPerspectiveCamera(state: Viewer3DState): boolean {
            return state.camera.type === "perspective";
        }
    },

    // > Actions
    actions: {
        /**
         * Restore the status from a provided object
         *
         * @param rawState - Viewer3D status in JSON format
         */
        restoreState(rawState: string | undefined): void {

            if(!rawState) return;
            const state = JSON.parse(rawState) as Viewer3DState;

            this.camera.type = state.camera.type;
            this.camera.position[0] = state.camera.position[0];
            this.camera.position[1] = state.camera.position[1];
            this.camera.position[2] = state.camera.position[2];
            this.camera.lookAt[0] = state.camera.lookAt[0];
            this.camera.lookAt[1] = state.camera.lookAt[1];
            this.camera.lookAt[2] = state.camera.lookAt[2];
            this.camera.snapshotFormat = state.camera.snapshotFormat ?? "png";
            this.camera.snapshotTransparent = state.camera.snapshotTransparent ?? false;
            this.camera.stlFormat = state.camera.stlFormat ?? "binary";
            this.camera.forcePosition[0] = state.camera.forcePosition?.[0] ?? 5;
            this.camera.forcePosition[1] = state.camera.forcePosition?.[1] ?? 3;
            this.camera.forcePosition[2] = state.camera.forcePosition?.[2] ?? 5;
            this.camera.forceLookAt[0] = state.camera.forceLookAt?.[0] ?? 0;
            this.camera.forceLookAt[1] = state.camera.forceLookAt?.[1] ?? 0;
            this.camera.forceLookAt[2] = state.camera.forceLookAt?.[2] ?? 0;
            this.camera.autoReset = state.camera.autoReset ?? false;

            this.scene.background = state.scene.background;
            this.scene.depthCueing = state.scene.depthCueing;
            this.scene.depthNear = state.scene.depthNear;
            this.scene.depthFar = state.scene.depthFar;

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

            this.helpers.showAxis = state.helpers.showAxis ?? false;
            this.helpers.showGridXZ = state.helpers.showGridXZ ?? false;
            this.helpers.showGridXY = state.helpers.showGridXY ?? false;
            this.helpers.showGridYZ = state.helpers.showGridYZ ?? false;
            this.helpers.gridSize = state.helpers.gridSize ?? 10;
            this.helpers.axisLength = state.helpers.axisLength ?? 1;
            this.helpers.showGizmo = state.helpers.showGizmo ?? false;
        },
        /**
         * Reset the viewer to the factory defaults
         */
        resetViewer(): void {

            this.camera.type = "orthographic";
            this.camera.position[0] = 5;
            this.camera.position[1] = 3;
            this.camera.position[2] = 5;
            this.camera.lookAt[0] = 0;
            this.camera.lookAt[1] = 0;
            this.camera.lookAt[2] = 0;
            this.camera.snapshotFormat = "png";
            this.camera.snapshotTransparent = false;
            this.camera.stlFormat = "binary";
            this.camera.forcePosition[0] = 5;
            this.camera.forcePosition[1] = 3;
            this.camera.forcePosition[2] = 5;
            this.camera.forceLookAt[0] = 0;
            this.camera.forceLookAt[1] = 0;
            this.camera.forceLookAt[2] = 0;
            this.camera.autoReset = false;

    		this.scene.background = "#90CEEC";
            this.scene.depthCueing = false;
            this.scene.depthNear = 10;
            this.scene.depthFar = 50;

            this.lights.ambientColor = "#FFFFFF";
			this.lights.ambientIntensity = 0.5;
			this.lights.directional1Color = "#FFFFFF";
			this.lights.directional1Intensity = 1.5;
			this.lights.directional2Color = "#FFFFFF";
			this.lights.directional2Intensity = 1.5;
			this.lights.directional3Color = "#FFFFFF";
			this.lights.directional3Intensity = 1.5;
			this.lights.directional1Position[0] = 0;
			this.lights.directional1Position[1] = 1;
			this.lights.directional1Position[2] = 0;
			this.lights.directional2Position[0] = 0.5774;
			this.lights.directional2Position[1] = 0.5774;
			this.lights.directional2Position[2] = 0.5774;
			this.lights.directional3Position[0] = -0.5774;
			this.lights.directional3Position[1] = -0.5774;
			this.lights.directional3Position[2] = -0.5774;

            this.helpers.showAxis = false;
            this.helpers.showGridXZ = false;
            this.helpers.showGridXY = false;
            this.helpers.showGridYZ = false;
            this.helpers.gridSize = 10;
            this.helpers.axisLength = 1;
            this.helpers.showGizmo = false;
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
	/* oxlint-disable-next-line @typescript-eslint/strict-void-return */
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
