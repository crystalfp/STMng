/**
 * Manage the connection between modules and inside modules with their GUI.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {watch} from "vue";
import {receiveProject, sendProject} from "@/services/RoutesClient";
import {useSwitchboardStore} from "@/stores/switchboardStore";
import {useConfigStore} from "../../new/stores/configStore";
import {projectIsValid} from "@/services/Validators";
import {NodeInfo} from "@/services/NodeInfo";
import type {NodeUI, Project} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";
import {sm} from "../../new/services/SceneManager";

/** Type of the parameters */
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

	/**
	 * At switchboard creation, access the node specific functionalities
	 */
	private constructor() {
		this.nodeInfo = new NodeInfo();
	}

	/**
	 * Parse the inputs from the graph
	 *
	 * @param id - ID of the node for which the inputs should be defined
	 * @param input - String of inputs from the graph
	 * @param map - Map to be set with the inputs
	 */
	private setupInputs(id: string, input: string | undefined, map: Map<string, string[]>): void {

		if(!input) return;

		const inputs = input.split(/, */);

		map.set(id, inputs);
	}

	// > Setup the Switchboard
	/**
	 * Setup the Switchboard
	 *
	 * @remarks Should be run after IPC is setup
	 */
	setup(): void {

		// Receive the project
		receiveProject((rawProject: string) => {

			// Decode the project
			try {
				this.project = JSON.parse(rawProject) as Project;
			}
			catch(error) {
				showErrorNotification(`Invalid project file format. Error: ${(error as Error).message}`);
				return;
			}

			// Check the project
			if(!projectIsValid(this.project)) {
				showErrorNotification("Invalid project content. Project not loaded");
				return;
			}

			// Clean the previous project content
			this.nodesUI.length = 0;
			this.mapIdToType.clear();
			this.mapIdToCode.clear();
			this.mapIdToInputs.clear();

			// Clear the scene
			sm.clearScene();

			// Access the store
			const switchboardStore = useSwitchboardStore();

			// Empty the store
			switchboardStore.clear();

			// For each module of the project graph
			for(const id in this.project.graph) {

				// Access the node (id is its id)
				const node = this.project.graph[id];

				// Set mapping from module to its type
				this.mapIdToType.set(id, node.type);

				// Access the UI for the module
				const nodeUI = this.nodeInfo.getNodeUI(id, node);
				if(nodeUI) this.nodesUI.push(nodeUI);

				// Prepare the params area for the module
				switchboardStore.initNode(id);

				// Set the connections to the inputs
				this.setupInputs(id, node.in, this.mapIdToInputs);

				// Setup the mapping to the runtime code
				this.nodeInfo.setupRuntime(node.type, id, this.mapIdToCode);
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

	/**
	 * When the switchboard is ready, the callback is called to setup the UI
	 *
	 * @param callback - Function to be called to setup the UI
	 */
	subscribeToUiNodes(callback: (nodes: NodeUI[], currentId: string) => void): void {

		// Save the callback
		this.nodesCallback = callback;
/*
		// If there is at least one node in the graph, run the callback
		let hasNodes = false;
		if(this.project) for(const id in this.project.graph) {void id; hasNodes = true; break;}
		console.log("+++", hasNodes, this.project?.graph);
		if(this.project && Object.keys(this.project.graph).length > 0) console.log("???", hasNodes); // hasNodes = true;
		if(hasNodes) callback(this.nodesUI, this.currentId);
		*/
	}

	/**
	 * Receive the UI parameters
	 *
	 * @param id - ID of the node receiving the UI parameters
	 * @param callback - Function to be called when the UI parameters change
	 */
	getUiParams(id: string, callback: (params: UiParams) => void): void {

		const switchboardStore = useSwitchboardStore();

		watch(switchboardStore.ui[id],
			  () => callback(switchboardStore.ui[id]),
			  {deep: true});
		callback(switchboardStore.ui[id]);
	}

	/**
	 * Send parameters to the user interface
	 *
	 * @param id - ID of the node
	 * @param params - Parameters to be passed to the UI
	 */
	setUiParams(id: string, params: UiParams): void {

		const switchboardStore = useSwitchboardStore();

		if(!(id in switchboardStore.ui)) return; // Sanity check
		for(const par in params) switchboardStore.ui[id][par] = params[par];
	}

	/**
	 * Restore UI status
	 *
	 * @param savedProject - Project from which the status should be restored
	 */
	private restoreStatus(savedProject: Project): void {

		// Restore viewer if it has been saved
		if(savedProject.viewer) {

			const configStore = useConfigStore();
			const {camera, scene, lights, helpers} = configStore;
			const {camera: savedCamera, scene: savedScene,
				   lights: savedLights, helpers: savedHelpers} = savedProject.viewer;
			camera.type        = savedCamera.type;
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
        	helpers.showAxis   = savedHelpers.showAxis;
        	helpers.showGridXZ = savedHelpers.showGridXZ;
        	helpers.showGridXY = savedHelpers.showGridXY;
        	helpers.showGridYZ = savedHelpers.showGridYZ;
        	helpers.gridSize   = savedHelpers.gridSize;
        	helpers.axisLength = savedHelpers.axisLength;
		}

		// Restore ui parameters for nodes
		for(const id in savedProject.ui) {
			this.setUiParams(id, savedProject.ui[id]);
		}
	}

	/**
	 * Set data in output
	 *
	 * @param id - ID of the node that sets the data
	 * @param data - Data to transmit
	 */
	setData(id: string, data: unknown): void {

		const switchboardStore = useSwitchboardStore();

		const type = this.mapIdToType.get(id);

		this.nodeInfo.setDataOutputs(id, type, data, switchboardStore.data[id]);
	}

	/**
	 * Get data from other nodes
	 *
	 * @param id - ID of the node receiving the data
	 * @param callback - Function called when the data changes
	 */
	getData(id: string, callback: (data: unknown, idFrom: string) => void): void {

		const inputs = this.mapIdToInputs.get(id);
		if(!inputs) return;

		const switchboardStore = useSwitchboardStore();

		for(const idFrom of inputs) {

			const type = this.mapIdToType.get(idFrom);

			this.nodeInfo.getDataInputs(id, type, idFrom, switchboardStore.data[idFrom], callback);
		}
	}

	/**
	 * Check if the node type generates also graphical output
	 *
	 * @param type - Type of the node
	 * @returns True if this node type generates graphical output
	 */
	generatesGraphics(type: string): boolean {

		return this.nodeInfo.generatesGraphics(type);
	}

	/**
	 * Get the viewer type
	 *
	 * @returns The type of the viewer 3D
	 */
	getViewerType(): string {

		return this.nodeInfo.getViewerType();
	}

	/**
	 * Check node type existence
	 *
	 * @param type - Node type to check
	 * @returns True if the node type exists
	 */
	checkType(type: string): boolean {
		return this.nodeInfo.checkType(type);
	}

	/**
	 * Get node type
	 *
	 * @param id - ID of a node
	 * @returns The type of the node or empty string if not existent
	 */
	getNodeType(id: string): string {
		return this.mapIdToType.get(id) ?? "";
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance.
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Switchboard object
	 */
    static getInstance(): Switchboard {

        if(!Switchboard.instance) {
            Switchboard.instance = new Switchboard();
        }

        return Switchboard.instance;
    }
}

// > Access to the switchboard
/** Access the switchboard */
export const sb = Switchboard.getInstance();
