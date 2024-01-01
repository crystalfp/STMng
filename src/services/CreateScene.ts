
import * as THREE from "three";
import {watchEffect} from "vue";
import {sb} from "@/services/Switchboard";
import {useConfigStore} from "@/stores/configStore";

export const createScene = (): THREE.Scene => {

	const scene = sb.accessScene();

	const configStore = useConfigStore();

	scene.background = new THREE.Color(configStore.scene.background);
	watchEffect(() => {
		scene.background = new THREE.Color(configStore.scene.background);
	});
	return scene;
};
