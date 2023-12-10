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
			background: "#90CEEC",
			showGrid: true,
			showAxis: true,
		},
		lights: {
			ambientColor: "#FFFFFF",
			ambientIntensity: 0.5,
			directional1Color: "#FFFFFF",
			directional1Intensity: 3,
			directional2Color: "#FFFF00",
			directional2Intensity: 3,
			directional3Color: "#FF0000",
			directional3Intensity: 3,
			directional1Position: [0, 1, 0],
			directional2Position: [1, 1, 1],
			directional3Position: [-1, -1, -1],
		},
		materials: {
			quality: 3,
			roughness: 0.7,
			metalness: 0.3
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
