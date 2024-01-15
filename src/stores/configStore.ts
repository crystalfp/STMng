/**
 * The shared state of the application.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";

interface Viewer3DConfiguration {

    camera: {
        perspective: boolean;
        position: [number, number, number];
    };
    scene: {
        background: string;
    };
    lights: {
        ambientColor: string;
        ambientIntensity: number;
        directional1Color: string;
        directional1Intensity: number;
        directional1Position: [number, number, number];
        directional2Color: string;
        directional2Intensity: number;
        directional2Position: [number, number, number];
        directional3Color: string;
        directional3Intensity: number;
        directional3Position: [number, number, number];
    };
    control: {
        reset: boolean;
        snapshot: boolean;
    };
}


export const useConfigStore = defineStore("ConfigStore", {

    state: () => ({

		camera: {
			perspective: true,
            position: [5, 3, 5],
		},
		scene: {
			background: "#90CEEC",
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
        control: {
            reset: false,
            snapshot: false,
        }
	} as Viewer3DConfiguration),

    // > Getters
    getters: {
        statusToSave(state: Viewer3DConfiguration) {
            const statusToSave = {
                camera: state.camera,
                scene: state.scene,
                lights: state.lights
            };
            return JSON.stringify(statusToSave);
        }
    }
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useConfigStore, import.meta.hot));
}
