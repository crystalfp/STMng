/**
 * The shared state of the application.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";
import type {Viewer3DConfiguration} from "@/types";


export const useConfigStore = defineStore("ConfigStore", {

    state: () => ({

		camera: {
			perspective: true,
			orthoSide: 10
		},
		scene: {
			background: "skyblue",
			showGrid: true,
			showAxis: true,
			quality: 3,
		},
		lights: {
			ambientColor: "white",
			ambientIntensity: 0.5,
			directional1Color: "white",
			directional1Intensity: 3,
			directional2Color: "yellow",
			directional2Intensity: 3,
			directional3Color: "red",
			directional3Intensity: 3,
			directional1Position: [0, 1, 0],
			directional2Position: [1, 1, 1],
			directional3Position: [-1, -1, -1],
		}
	} as Viewer3DConfiguration),
/*
    // > Getters
    getters: {
	},

    // > Actions
    actions: {
		// >> Initialize the store
        initializeConfigStore() {
		},
	},
*/
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
