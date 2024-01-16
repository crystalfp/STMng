/**
 * Manage the connection between modules and inside modules with their GUI.
 *
 * @packageDocumentation
 */
import {watch} from "vue";
import log from "electron-log";
import {receiveProject, sendProject} from "@/services/RoutesClient";
import {useSwitchboardStore} from "@/stores/switchboardStore";
import {useConfigStore} from "@/stores/configStore";
import {projectIsValid} from "@/services/Validators";
import {NodeInfo} from "@/services/NodeInfo";
import type {NodeUI, Project} from "@/types";

export type UiParams = Record<string, string | number | boolean>;

class Switchboard {

    private static instance: Switchboard;
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
			switchboardStore.clear();

			// For each module of the project graph
			for(const node of this.project.graph) {

				// Set mapping from module to its type
				this.mapIdToType.set(node.id, node.type);

				// Access the UI for the module
				const nodeUI = this.nodeInfo.getUICode(node);
				if(nodeUI) this.nodesUI.push(nodeUI);

				// Prepare the params area for the module
				switchboardStore.initNode(node.id);

				// Set the connections to the inputs
				this.setupInputs(node.id, node.in, this.mapIdToInputs);

				// Setup the mapping to the runtime code
				this.nodeInfo.setupRuntime(node.type, node.id, this.mapIdToCode);
			}

			// Setup the current module
			this.currentId = this.project.currentId ?? this.nodesUI[0].id;

			// Restore the status
			this.restoreStatus(this.project);

			// Call the nodes callback if it is already set
			if(this.nodesCallback) this.nodesCallback(this.nodesUI, this.currentId);
		});

		// Send the project to main process for saving it
		sendProject(() => {

			// Save the project
			const graph = this.project?.graph;
			if(!graph) return "";
			let project = `{"graph":${JSON.stringify(graph)},`;

			// Save the viewer status
			const configStore = useConfigStore();
			project += `"viewer":${configStore.statusToSave},`;

			// Save the modules' UI status
			project += this.nodeInfo.saveUiStatus(this.mapIdToCode, this.mapIdToType);

			// Save the current selected node and close the project structure
			project += `,"currentId":"${this.currentId}"}`;

			// Save the project
			return JSON.stringify(JSON.parse(project), undefined, 2);
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

	private restoreStatus(savedProject: Project): void {

		// Restore viewer if it has been saved
		if(savedProject.viewer) {

			const configStore = useConfigStore();
			const {camera, scene, lights} = configStore;
			const {camera: savedCamera, scene: savedScene, lights: savedLights} = savedProject.viewer;
			camera.perspective = savedCamera.perspective;
			camera.position[0] = savedCamera.position[0];
			camera.position[1] = savedCamera.position[1];
			camera.position[2] = savedCamera.position[2];
			camera.lookAt[0] = savedCamera.lookAt[0];
			camera.lookAt[1] = savedCamera.lookAt[1];
			camera.lookAt[2] = savedCamera.lookAt[2];
			camera.snapshotFormat = savedCamera.snapshotFormat;
			scene.background = savedScene.background;
			lights.ambientColor = savedLights.ambientColor;
			lights.ambientIntensity = savedLights.ambientIntensity;
			lights.directional1Color = savedLights.directional1Color;
			lights.directional2Color = savedLights.directional2Color;
			lights.directional3Color = savedLights.directional3Color;
			lights.directional1Intensity = savedLights.directional1Intensity;
			lights.directional2Intensity = savedLights.directional2Intensity;
			lights.directional3Intensity = savedLights.directional3Intensity;
			lights.directional1Position[0] = savedLights.directional1Position[0];
			lights.directional2Position[0] = savedLights.directional2Position[0];
			lights.directional3Position[0] = savedLights.directional3Position[0];
			lights.directional1Position[1] = savedLights.directional1Position[1];
			lights.directional2Position[1] = savedLights.directional2Position[1];
			lights.directional3Position[1] = savedLights.directional3Position[1];
			lights.directional1Position[2] = savedLights.directional1Position[2];
			lights.directional2Position[2] = savedLights.directional2Position[2];
			lights.directional3Position[2] = savedLights.directional3Position[2];
		}

		// Restore ui parameters for nodes
		for(const id in savedProject.ui) {
			this.setUiParams(id, savedProject.ui[id]);
		}
	}

	setData(id: string, data: unknown): void {

		const switchboardStore = useSwitchboardStore();

		const type = this.mapIdToType.get(id);

		this.nodeInfo.setDataInputs(id, type, data, switchboardStore.data[id]);
	}

	getData(id: string, callback: (data: unknown, idFrom: string) => void): void {

		const inputs = this.mapIdToInputs.get(id);
		if(!inputs) return;

		const switchboardStore = useSwitchboardStore();

		for(const idFrom of inputs) {

			const type = this.mapIdToType.get(idFrom);

			this.nodeInfo.getDataInputs(id, type, idFrom, switchboardStore.data[idFrom], callback);
		}
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
