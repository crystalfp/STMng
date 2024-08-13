/**
 * Manage the scene to be show.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import * as THREE from "three";
import {watchEffect} from "vue";
import {useConfigStore} from "../stores/configStore";
import {useControlStore} from "../stores/controlStore";
import type {BoundingBox} from "./BoundingBox";
import {STLExporter} from "three/addons/exporters/STLExporter.js";

class SceneManager {

    private static instance: SceneManager;
	private static readonly scene = new THREE.Scene();
	private exporter: STLExporter | undefined;

	private constructor() {
		this.clearScene();
	}

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
	 * Remove objects with children
	 *
	 * @param object - The object to remove
	 */
	private removeObjectsWithChildren(object: THREE.Object3D): void {

        if(object.children.length > 0) {
            for(let idx = object.children.length - 1; idx >= 0; idx--) {
                this.removeObjectsWithChildren(object.children[idx]);
            }
        }

		if(object.type === "Mesh") {
			const mesh =  object as THREE.Mesh;

			if(mesh.geometry) {
				mesh.geometry.dispose();
			}
			if(mesh.material) {
				(mesh.material as THREE.Material).dispose();
			}
        }

        object.removeFromParent();
	}

	private readonly lights: string[] = ["AmbientLight", "DirectionalLight"];

	/**
	 * Clear the scene of all graphical objects
	 */
	clearScene(): void {

		for(const object of SceneManager.scene.children) {

			if(this.lights.includes(object.type)) continue;
			this.removeObjectsWithChildren(object);
		}
	}

	/**
	 * Empty a group with the given name
	 *
	 * @param groupName - Name of the group to be cleared
	 * @param removeGroup - If true remove also the group itself from the scene
	 */
	clearGroup(groupName: string, removeGroup=false): void {

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

		// Remove the group itself
		if(removeGroup) SceneManager.scene.remove(group);
	}

	/**
	 * Delete a mesh with the given name
	 *
	 * @param meshName - Name of the mesh to be deleted
	 */
	deleteMesh(meshName: string): void {

        const object = SceneManager.scene.getObjectByName(meshName) as THREE.Mesh;
        if(object) {
            SceneManager.scene.remove(object);
            if(object.geometry) object.geometry.dispose();
			(object.material as THREE.Material).dispose();
        }
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

		const controlStore = useControlStore();
		controlStore.sceneCenter = boundingBox.center;
		controlStore.sceneSides  = boundingBox.side;
	}

	/**
	 * Write an item from the scene
	 *
	 * @param count - Count items to dump (with zero do nothing)
	 * @param type - Item type
	 * @param name - Item name
	 * @param indent - String to put at the beginning of the line
	 * @returns The string to add to the whole dump
	 */
	private dumpItem(count: number, type: string, name: string, indent: string): string {
		if(count > 0) {
			const currentCountString = count > 1 ? ` (${count})` : "";
			const nameString = name ? ` ${name}` : "";
			return `${indent}${type}${nameString}${currentCountString}\n`;
		}
		return "";
	}

	/**
	 * Walk over the scene3D or one Group
	 *
	 * @param indent - String to put at the beginning of the line
	 * @param children - List pf item children
	 * @returns The string to print
	 */
	private dumpSceneWalker(indent: string, children: THREE.Object3D[]): string {

		let currentType = "";
		let currentName = "";
		let currentCount = 0;
		let out = "";

		for(const child of children) {

			if(child.type === "Group") {

				out += this.dumpItem(currentCount, currentType, currentName, indent);
				currentType = "";
				currentName = "";
				currentCount = 0;
				out += `${indent}${child.type} ${child.name}\n`;
				out += this.dumpSceneWalker(`${indent}   `, child.children);
			}
			else if(child.type !== currentType || child.name !== currentName) {

				out += this.dumpItem(currentCount, currentType, currentName, indent);
				currentType = child.type;
				currentName = child.name;
				currentCount = 1;
			}
			else {
				++currentCount;
			}
		}

		out += this.dumpItem(currentCount, currentType, currentName, indent);

		return out;
	}

	/**
	 * Dump the 3D scene on the Dev Tools console (useful for debugging)
	 *
	 * @param label - Title for this dump
	 */
	dumpScene(label: string): void {

		const out = this.dumpSceneWalker("", SceneManager.scene.children);
		console.log(`\n*** ${label} ***\n${out}`);
	}

	/**
	 * Export as STL encoded file the scene content
	 *
	 * @param format - STL file format
	 * @returns A string (format: ascii) or an ArrayBuffer (format: binary)
	 *			with the content of the STL file to be written
	 */
	createSTL(format: "ascii" | "binary"): string | ArrayBuffer {

		// Instance the exporter if not already instanced
		if(!this.exporter) this.exporter = new STLExporter();

		// Create a group with only atoms and bonds
		const structure = new THREE.Group();
		const atoms = this.scene.getObjectByName("Atoms");
		if(atoms) {
			const atoms2 = atoms.clone(true);
			structure.add(atoms2);
		}
		const bonds = this.scene.getObjectByName("Bonds");
		if(bonds) {
			const bonds2 = bonds.clone(true);
			structure.add(bonds2);
		}

		// Parse the structure and generate the STL encoded output
		const result = this.exporter.parse(structure, {binary: format === "binary"});

		// Clean the temporary structure
		structure.clear();

		// Return the results
		return format === "ascii" ? result as string : (result as DataView).buffer;
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Scene Manager object
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
