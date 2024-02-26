/**
 * Manage the scene to be show.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";
import type {BoundingBox} from "@/services/BoundingBox";

class SceneManager {

    private static instance: SceneManager;
	private static readonly scene = new THREE.Scene();

	/**
	 * Create the scene
	 *
	 * @returns The created scene
	 */
	createScene(): THREE.Scene {

		const configStore = useConfigStore();

		SceneManager.scene.background = new THREE.Color(configStore.scene.background);
		watchEffect(() => {
			SceneManager.scene.background = new THREE.Color(configStore.scene.background);
		});
		return SceneManager.scene;
	}

	/**
	 * Clear the scene of all graphical objects
	 */
	clearScene(): void {

		SceneManager.scene.traverse((object) => {

			if(["AmbientLight", "DirectionalLight", "Scene"].includes(object.type)) return;
			object.clear();
		});
	}

	/**
	 * Empty a group with the given name
	 *
	 * @param groupName - Name of the group to be cleared
	 */
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

	/**
	 * Access the scene
	 */
	get scene(): THREE.Scene {
		return SceneManager.scene;
	}

	/**
	 * Add an object to the scene
	 *
	 * @param obj - Object to be added to the scene
	 */
	add(obj: THREE.Object3D): void {
		SceneManager.scene.add(obj);
	}

	/**
	 * Create lights
	 */
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

	/**
	 * Save the scene bounding box to be used by camera positioning
	 *
	 * @param boundingBox - The scene bounding box
	 */
	setBoundingBox(boundingBox: BoundingBox): void {

		const configStore = useConfigStore();
		configStore.control.sceneCenter = boundingBox.center;
		configStore.control.sceneSides = boundingBox.side;
	}

	/**
	 * Dump the scene excluding lights and scene itself (useful for debugging)
	 *
	 * @param label - Identifier for this dump
	 */
	// dumpScene(label: string): void {
	// 	console.log(`\n*** ${label} ***`);
	// 	SceneManager.scene.traverse((object) => {
	// 		if(["AmbientLight", "DirectionalLight", "Scene"].includes(object.type)) return;
	// 		console.log(object.type, object.name);
	// 	});
	// }

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
