/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {watchEffect} from "vue";

import {useConfigStore} from "@/stores/configStore";

export const createLights = (scene: THREE.Scene): void => {

	const configStore = useConfigStore();

    // Add directional lights
    const light1 = new THREE.DirectionalLight(configStore.lights.directional1Color,
                                              configStore.lights.directional1Intensity);
    light1.position.set(...configStore.lights.directional1Position);
    scene.add(light1);
    watchEffect(() => {
		light1.intensity = configStore.lights.directional1Intensity;
		light1.color = new THREE.Color(configStore.lights.directional1Color);
        light1.position.set(...configStore.lights.directional1Position);
    });

    const light2 = new THREE.DirectionalLight(configStore.lights.directional2Color,
                                              configStore.lights.directional2Intensity);
    light2.position.set(...configStore.lights.directional2Position);
    scene.add(light2);
    watchEffect(() => {
		light2.intensity = configStore.lights.directional2Intensity;
		light2.color = new THREE.Color(configStore.lights.directional2Color);
        light2.position.set(...configStore.lights.directional2Position);
    });

    const light3 = new THREE.DirectionalLight(configStore.lights.directional3Color,
                                              configStore.lights.directional3Intensity);
    light3.position.set(...configStore.lights.directional3Position);
    scene.add(light3);
    watchEffect(() => {
		light3.intensity = configStore.lights.directional3Intensity;
		light3.color = new THREE.Color(configStore.lights.directional3Color);
        light3.position.set(...configStore.lights.directional3Position);
    });


    // Add ambient light
	const ambient = new THREE.AmbientLight(configStore.lights.ambientColor,
										   configStore.lights.ambientIntensity);
	scene.add(ambient);

	watchEffect(() => {
		ambient.intensity = configStore.lights.ambientIntensity;
		ambient.color = new THREE.Color(configStore.lights.ambientColor);
	});
};
