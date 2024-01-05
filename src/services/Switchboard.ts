/**
 * Manage the connection between modules and inside modules with their GUI.
 *
 * @packageDocumentation
 */
import {watch} from "vue";
import log from "electron-log";
import * as THREE from "three";
import {receiveProject, sendProject} from "@/services/RoutesClient";
import {useSwitchboardStore} from "@/stores/switchboardStore";
import {projectIsValid, type Project} from "@/services/Validators";
import {NodeInfo} from "@/services/NodeInfo";
import type {NodeUI, Structure} from "@/types";

export type UiParams = Record<string, string | number | boolean>;

class Switchboard {

    private static instance: Switchboard;
	private static readonly scene = new THREE.Scene();
	private nodesCallback: ((nodes: NodeUI[], currentId: string) => void) | undefined;
	private project: Project | undefined;
	private readonly nodesUI: NodeUI[] = [];
	private currentId = "";
	private readonly mapIdToType = new Map<string, string>();
	private readonly mapIdToCode = new Map<string, unknown>();
	private readonly mapIdToInputs = new Map<string, string[]>();
	private readonly nodeInfo;

	private constructor() {
		this.nodeInfo = new NodeInfo();
	}

	private setupInputs(id: string, input: string, map: Map<string, string[]>): void {

		if(!input) return;

		const inputs = input.split(/, */);

		map.set(id, inputs);
	}

	// > Setup the Switchboard
	/**
	 * Setup the Switchboard
	 * @remarks Should be run after the IPC is setup
	 */
	setup(): void {

		// Receive the project
		receiveProject((rawProject: string) => {

			// Decode and check the project
			try {
				this.project = JSON.parse(rawProject) as Project;

				if(!projectIsValid(this.project)) throw Error("Invalid IDs in the project");
			}
			catch(error: unknown) {
				log.error("Invalid project. Error:", (error as Error).message);
				return;
			}

			// Access the store
			const switchboardStore = useSwitchboardStore();

			// Clean the previous content
			this.nodesUI.length = 0;
			this.mapIdToType.clear();
			this.mapIdToCode.clear();
			this.mapIdToInputs.clear();

			// Empty the store
			for(const key in switchboardStore.ui) {
				delete switchboardStore.ui[key];
			}
			for(const key in switchboardStore.data) {
				delete switchboardStore.data[key];
			}

			// For each module of the project graph
			for(const node of this.project.graph) {

				// Set mapping from module to its type
				this.mapIdToType.set(node.id, node.type);

				// Access the UI for the module
				const nodeUI = this.nodeInfo.getUICode(node);
				if(nodeUI) this.nodesUI.push(nodeUI);

				// Prepare the params area for the module
				switchboardStore.ui[node.id] = {};
				switchboardStore.data[node.id] = {};

				this.setupInputs(node.id, node.in, this.mapIdToInputs);

				// Setup the mapping to the runtime code
				this.nodeInfo.setupRuntime(node.type, node.id, this.mapIdToCode);
			}

			// Setup the current module
			this.currentId = this.project.currentId ?? this.nodesUI[0].id;

			// Call the nodes callback if already set
			if(this.nodesCallback) this.nodesCallback(this.nodesUI, this.currentId);
		});

		// Send the project
		sendProject(() => {
			return JSON.stringify(this.project);
		});
	}

	subscribeToUiNodes(callback: (nodes: NodeUI[], currentId: string) => void): void {

		if(this.project && this.project.graph.length > 0) callback(this.nodesUI, this.currentId);
		this.nodesCallback = callback;
	}

	getUiParams(id: string, callback: (params: UiParams) => void): void {

		const switchboardStore = useSwitchboardStore();

		watch(switchboardStore.ui[id],
			  () => callback(switchboardStore.ui[id]),
			  {deep: true});
		callback(switchboardStore.ui[id]);
	}

	setUiParams(id: string, params: UiParams): void {

		const switchboardStore = useSwitchboardStore();

		for(const par in params) switchboardStore.ui[id][par] = params[par];
	}

	setData(id: string, data: unknown): void {

		const switchboardStore = useSwitchboardStore();

		const type = this.mapIdToType.get(id);

		// TODO Here add the other types
		switch(type) {
			case "structure-reader": {
				const typedData = data as Structure;
				const typedStore = switchboardStore.data[id] as Structure;
				typedStore.crystal = typedData.crystal;
				typedStore.atoms = typedData.atoms;
				typedStore.bonds = typedData.bonds;
				typedStore.look = typedData.look;

				break;
			}
			case "draw-structure": {
				// const typedData = data as THREE.Group;
				// const typedStore = switchboardStore.data[id] as THREE.Group;
				// typedStore = typedData;
				break;
			}
			case "viewer-3d":
				break;
			case "chart-viewer":
				break;
			case undefined:
				log.error(`Unknown id "${id}"`);
				break;
			default:
				log.error(`Unknown type "${type}" sending from ${id}`);
		}
	}

	getData(id: string, callback: (data: unknown, idFrom: string) => void): void {

		const inputs = this.mapIdToInputs.get(id);
		if(!inputs) return;

		const switchboardStore = useSwitchboardStore();

		for(const idFrom of inputs) {

			const type = this.mapIdToType.get(idFrom);

			// TODO Here add the other types
			switch(type) {
				case "structure-reader":
					watch(switchboardStore.data[idFrom] as Structure,
						() => callback(switchboardStore.data[idFrom], idFrom),
						{deep: true});
					callback(switchboardStore.data[idFrom], idFrom);
					break;
				case "draw-structure":
				case "viewer-3d":
					log.error(`Cannot use getData with type "${type}" id: "${id}"`);
					break;
				case "chart-viewer":
					break;
				case undefined:
					log.error(`Unknown id "${id}"`);
					break;
				default:
					log.error(`Unknown type "${type}" sending from ${id}`);
			}
		}
	}

	sceneAddGroup(group: THREE.Group): void {

		Switchboard.scene.add(group);
	}

	sceneClearGroup(groupName: string): void {

		const group = Switchboard.scene.getObjectByName(groupName);
		if(!group) return;

		// Meshes to be delete from the group
		const meshes: THREE.Mesh[] = [];

		// Remove meshes' parts
		group.traverse((object) => {

			if(object.type === "Group") return;
			// if(object.type !== "Mesh") return;
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
		return Switchboard.scene;
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
    static getInstance(): Switchboard {

        if(!Switchboard.instance) {
            Switchboard.instance = new Switchboard();
        }

        return Switchboard.instance;
    }
}

// > Access to the switchboard
/** Access to the switchboard */
export const sb = Switchboard.getInstance();
