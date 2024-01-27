/**
 * Manage the connection between modules and inside modules with their GUI.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";

class SceneManager {

    private static instance: SceneManager;
	private static readonly scene = new THREE.Scene();

	createScene(): THREE.Scene {

		const configStore = useConfigStore();

		SceneManager.scene.background = new THREE.Color(configStore.scene.background);
		watchEffect(() => {
			SceneManager.scene.background = new THREE.Color(configStore.scene.background);
		});
		return SceneManager.scene;
	}

	clearGroup(groupName: string): void {

		const group = SceneManager.scene.getObjectByName(groupName);
		if(!group) return;

		// Meshes to be delete from the group
		const meshes: THREE.Mesh[] = [];

		// Remove meshes' parts
		group.traverse((object) => {

			if(object.type === "Group") return;

			const mesh = object as THREE.Mesh;
			if(mesh.geometry) mesh.geometry.dispose();
			if(mesh.material) {
				if(Array.isArray(mesh.material)) {
					for(const material of mesh.material) (material as THREE.Material).dispose();
				}
				else {
					(mesh.material as THREE.Material).dispose();
				}
			}
			meshes.push(mesh);
		});

		// Clear the group
		for(const mesh of meshes) group.remove(mesh);
        group.clear();
	}

	accessScene(): THREE.Scene {
		return SceneManager.scene;
	}

	add(obj: THREE.Object3D): void {
		SceneManager.scene.add(obj);
	}

	createLights(): void {

		const configStore = useConfigStore();

		// Add directional lights
		const light1 = new THREE.DirectionalLight(configStore.lights.directional1Color,
												configStore.lights.directional1Intensity);
		light1.position.set(...configStore.lights.directional1Position);
		SceneManager.scene.add(light1);
		watchEffect(() => {
			light1.intensity = configStore.lights.directional1Intensity;
			light1.color = new THREE.Color(configStore.lights.directional1Color);
			light1.position.set(...configStore.lights.directional1Position);
		});

		const light2 = new THREE.DirectionalLight(configStore.lights.directional2Color,
												configStore.lights.directional2Intensity);
		light2.position.set(...configStore.lights.directional2Position);
		SceneManager.scene.add(light2);
		watchEffect(() => {
			light2.intensity = configStore.lights.directional2Intensity;
			light2.color = new THREE.Color(configStore.lights.directional2Color);
			light2.position.set(...configStore.lights.directional2Position);
		});

		const light3 = new THREE.DirectionalLight(configStore.lights.directional3Color,
												configStore.lights.directional3Intensity);
		light3.position.set(...configStore.lights.directional3Position);
		SceneManager.scene.add(light3);
		watchEffect(() => {
			light3.intensity = configStore.lights.directional3Intensity;
			light3.color = new THREE.Color(configStore.lights.directional3Color);
			light3.position.set(...configStore.lights.directional3Position);
		});


		// Add ambient light
		const ambient = new THREE.AmbientLight(configStore.lights.ambientColor,
											configStore.lights.ambientIntensity);
		SceneManager.scene.add(ambient);

		watchEffect(() => {
			ambient.intensity = configStore.lights.ambientIntensity;
			ambient.color = new THREE.Color(configStore.lights.ambientColor);
		});
	}

	setCenter(center: [number, number, number]): void {

		const configStore = useConfigStore();
		configStore.control.target = center;
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The configuration object
	 */
    static getInstance(): SceneManager {

        if(!SceneManager.instance) {
            SceneManager.instance = new SceneManager();
        }

        return SceneManager.instance;
    }
}

// > Access to the scene manager
/** Access to the scene manager */
export const sm = SceneManager.getInstance();
