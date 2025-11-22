/**
 * Manage the scene to be shown.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {Group, type Material, Mesh, Scene, type Object3D,
		type InstancedMesh, MeshBasicMaterial, Fog,
		DirectionalLight, AmbientLight, Color, Matrix4,
		CylinderGeometry, SphereGeometry} from "three";
import {STLExporter} from "three/addons/exporters/STLExporter.js";
import {watchEffect} from "vue";
import {useConfigStore} from "@/stores/configStore";
import {useControlStore} from "@/stores/controlStore";
import {getBoundingSphere, type BoundingSphere} from "./BoundingSphere";
import type {StructureRenderInfo} from "@/types";

/**
 * Routines related to the 3D scene
 * @notExported
 */
class SceneManager {

    private static instance: SceneManager;
	private static readonly scene = new Scene();
	private exporter: STLExporter | undefined;
	private sceneModified = true;
	private boundingSphere: BoundingSphere | undefined;
	private readonly preserve = new Set(["AmbientLight", "DirectionalLight",
										 "Scene", "Group"]);

	/**
	 * Initialize the graphical scene
	 */
	private constructor() {
		this.clearScene();
	}

	/**
	 * Create the scene
	 *
	 * @returns The created scene
	 */
	createScene(): Scene {

		const configStore = useConfigStore();

		SceneManager.scene.background = new Color(configStore.scene.background);
		watchEffect(() => {
			SceneManager.scene.background = new Color(configStore.scene.background);
			this.sceneModified = true;
		});
		this.sceneModified = true;

		return SceneManager.scene;
	}

	/**
	 * Make the scene background transparent
	 *
	 * @param transparent - True to make the scene background transparent
	 */
	transparentSceneBackground(transparent: boolean): void {

		const configStore = useConfigStore();

		// eslint-disable-next-line unicorn/no-null
		SceneManager.scene.background = transparent ? null : new Color(configStore.scene.background);
		this.sceneModified = true;
	}

	/**
	 * Clear the scene of all graphical objects
	 */
	clearScene(): void {

		const meshList: Mesh[] = [];
		const otherList: Object3D[] = [];

		SceneManager.scene.traverse((object) => {

			if(this.preserve.has(object.type)) return;

			if(object.type === "Mesh") {
				meshList.push(object as Mesh);
			}
			else {
				otherList.push(object);
			}
		});

		for(const mesh of meshList) {
			if(mesh.geometry) mesh.geometry.dispose();
			if(mesh.material) (mesh.material as Material).dispose();
			mesh.removeFromParent();
			SceneManager.scene.remove(mesh);
		}
		for(const other of otherList) {
			SceneManager.scene.remove(other);
		}

		this.sceneModified = true;
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
		const meshes: Mesh[] = [];

		// Remove meshes' parts
		group.traverse((object) => {

			if(object.type === "Group") return;

			const mesh = object as Mesh;
			if(mesh.geometry) mesh.geometry.dispose();
			if(mesh.material) {
				if(Array.isArray(mesh.material)) {
					for(const material of mesh.material) material.dispose();
				}
				else {
					mesh.material.dispose();
				}
			}
			meshes.push(mesh);
		});

		// Clear the group
		for(const mesh of meshes) {group.remove(mesh);}
        group.clear();

		// Remove the group itself
		if(removeGroup) SceneManager.scene.remove(group);
		this.sceneModified = true;
	}

	/**
	 * Delete a mesh with the given name
	 *
	 * @param meshName - Name of the mesh to be deleted
	 */
	deleteMesh(meshName: string): void {

        const object = SceneManager.scene.getObjectByName(meshName) as Mesh;
        if(object) {
            SceneManager.scene.remove(object);
            if(object.geometry) object.geometry.dispose();
			(object.material as Material).dispose();
			this.sceneModified = true;
        }
	}

	/**
	 * Add an object to the scene
	 *
	 * @param obj - Object to be added to the scene
	 */
	add(obj: Object3D): void {
		SceneManager.scene.add(obj);
		this.sceneModified = true;
	}

	/**
	 * Remove an object from the scene
	 *
	 * @param obj - Object to be removed from the scene
	 */
	remove(obj: Object3D): void {
		SceneManager.scene.remove(obj);
		this.sceneModified = true;
	}

	/**
	 * Get an object by name from the scene
	 *
	 * @param name - Name of the object to be retrieved
	 * @returns The object with the given name or undefined if not found
	 */
	getObjectByName(name: string): Object3D | undefined {
		return SceneManager.scene.getObjectByName(name);
	}

	/**
	 * Remove a named group and re-add it
	 *
	 * @param group - Named group to add
	 */
	clearAndAddGroup(group: Group): void {

		if(group.name) {
			const previousObj = SceneManager.scene.getObjectByName(group.name);
			if(previousObj) SceneManager.scene.remove(previousObj);
		}
		SceneManager.scene.add(group);
		this.sceneModified = true;
	}

	/**
	 * Create lights
	 */
	createLights(): void {

		const configStore = useConfigStore();

		// Add directional lights
		const light1 = new DirectionalLight(configStore.lights.directional1Color,
											configStore.lights.directional1Intensity);
		SceneManager.scene.add(light1);
		watchEffect(() => {
			light1.intensity = configStore.lights.directional1Intensity;
			light1.color = new Color(configStore.lights.directional1Color);
			light1.position.set(...configStore.lights.directional1Position);
			this.sceneModified = true;
		});

		const light2 = new DirectionalLight(configStore.lights.directional2Color,
											configStore.lights.directional2Intensity);
		SceneManager.scene.add(light2);
		watchEffect(() => {
			light2.intensity = configStore.lights.directional2Intensity;
			light2.color = new Color(configStore.lights.directional2Color);
			light2.position.set(...configStore.lights.directional2Position);
			this.sceneModified = true;
		});

		const light3 = new DirectionalLight(configStore.lights.directional3Color,
											configStore.lights.directional3Intensity);
		SceneManager.scene.add(light3);
		watchEffect(() => {
			light3.intensity = configStore.lights.directional3Intensity;
			light3.color = new Color(configStore.lights.directional3Color);
			light3.position.set(...configStore.lights.directional3Position);
			this.sceneModified = true;
		});

		// Add ambient light
		const ambient = new AmbientLight(configStore.lights.ambientColor,
											configStore.lights.ambientIntensity);
		SceneManager.scene.add(ambient);
		watchEffect(() => {
			ambient.intensity = configStore.lights.ambientIntensity;
			ambient.color = new Color(configStore.lights.ambientColor);
			this.sceneModified = true;
		});
		this.sceneModified = true;
	}

	/**
	 * Save the scene bounding sphere to be used by camera positioning
	 *
	 * @param renderedStructure - Group containing the rendered structure
	 * @param renderInfo - Structure and other data for which the bounding sphere should be computed
	 */
	setBoundingSphere(renderedStructure: Group, renderInfo: StructureRenderInfo): void {

		this.boundingSphere = getBoundingSphere(renderedStructure, renderInfo);

		const controlStore = useControlStore();
		if(controlStore.sceneUnitCell) {
			controlStore.sceneCenter = this.boundingSphere.centerUC;
			controlStore.sceneRadius = this.boundingSphere.radiusUC;
		}
		else {
			controlStore.sceneCenter = this.boundingSphere.center;
			controlStore.sceneRadius = this.boundingSphere.radius;
		}
	}

	/**
	 * Save the unit cell visibility to use it in bounding sphere computation
	 *
	 * @param visible - Unit cell visibility
	 */
	setUnitCellVisible(visible: boolean): void {

		const controlStore = useControlStore();
		controlStore.sceneUnitCell = visible;
		if(!this.boundingSphere) return;

		if(controlStore.sceneUnitCell) {
			controlStore.sceneCenter = this.boundingSphere.centerUC;
			controlStore.sceneRadius = this.boundingSphere.radiusUC;
		}
		else {
			controlStore.sceneCenter = this.boundingSphere.center;
			controlStore.sceneRadius = this.boundingSphere.radius;
		}
	}

	/**
	 * Set depth cueing in the scene (that is, fog)
	 *
	 * @param enable - Enable depth cueing
	 * @param near - Start distance
	 * @param far - End distance for the fog
	 */
	setDepthCueing(enable: boolean, near?: number, far?: number): void {

		if(enable) {
			const configStore = useConfigStore();
			const bck = new Color(configStore.scene.background);
			SceneManager.scene.fog = new Fog(bck, near ?? 1, far ?? 100);
		}
		else {
			// eslint-disable-next-line unicorn/no-null
			SceneManager.scene.fog = null;
		}

		this.sceneModified = true;
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
	private static dumpItem(count: number, type: string, name: string, indent: string): string {

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
	private dumpSceneWalker(indent: string, children: Object3D[]): string {

		let currentType = "";
		let currentName = "";
		let currentCount = 0;
		let out = "";

		for(const child of children) {

			if(child.type === "Group") {

				out += SceneManager.dumpItem(currentCount, currentType, currentName, indent);
				currentType = "";
				currentName = "";
				currentCount = 0;
				out += `${indent}${child.type} ${child.name}\n`;
				out += this.dumpSceneWalker(`${indent}   `, child.children);
			}
			else if(child.type !== currentType || child.name !== currentName) {

				out += SceneManager.dumpItem(currentCount, currentType, currentName, indent);
				currentType = child.type;
				currentName = child.name;
				currentCount = 1;
			}
			else {
				++currentCount;
			}
		}

		out += SceneManager.dumpItem(currentCount, currentType, currentName, indent);

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
		this.exporter ??= new STLExporter();

		// Create a group with only atoms and bonds
		const structure = new Group();
		const atoms = SceneManager.scene.getObjectByName("Atoms");
		if(atoms) {

			atoms.traverse((object) => {
				if(object.type === "Mesh") {
					const im = object as InstancedMesh;
					for(let idx = 0; idx < im.count; idx++) {
						const matrix = new Matrix4();
						im.getMatrixAt(idx, matrix);
						const geometry = new SphereGeometry(1, 18, 18);
						geometry.applyMatrix4(matrix);
						const material = new MeshBasicMaterial();
						const sphere = new Mesh(geometry, material);
						structure.add(sphere);
					}
				}
			});
		}
		const bonds = SceneManager.scene.getObjectByName("Bonds");
		if(bonds) {
			bonds.traverse((object) => {
				if(object.type === "Mesh") {
					const im = object as InstancedMesh;
					const ImGeometry = im.geometry as CylinderGeometry;
					const radius = ImGeometry.parameters.radiusTop;
					for(let idx = 0; idx < im.count; idx++) {
						const matrix = new Matrix4();
						im.getMatrixAt(idx, matrix);
						const geometry = new CylinderGeometry(radius, radius, 1, 64, 1, false);
						geometry.applyMatrix4(matrix);
						const material = new MeshBasicMaterial();
						const cylinder = new Mesh(geometry, material);
						structure.add(cylinder);
					}
				}
			});
		}

		// Parse the structure and generate the STL encoded output
		const result = this.exporter.parse(structure, {binary: format === "binary"});

		// Clean the temporary structure
		structure.clear();

		// Return the results
		return format === "ascii" ? result as string : (result as DataView<ArrayBuffer>).buffer;
	}

	/**
	 * Something has changed, so the scene should be rendered
	 */
	modified(): void {

		this.sceneModified = true;
	}

	/**
	 * Traverse the scene and call the callback for each object
	 *
	 * @param callback - Callback to be called for each object in the scene
	 */
	traverse(callback: (object: Object3D) => void): void {
		SceneManager.scene.traverse(callback);
	}

	private retry = 0;
	/**
	 * Ask if the scene needs rendering because has been changed,
	 * then reset the modified flag
	 *
	 * @returns True if the scene should be rendered
	 */
	needRendering(): boolean {

		if(this.sceneModified) {
			if(this.retry > 2) {
				this.sceneModified = false;
				this.retry = 0;
			}
			++this.retry;
			return true;
		}
		return false;
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
