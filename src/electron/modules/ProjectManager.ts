/**
 * Load and store the visualized project, that is, the set of interconnected nodes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-06
 */
import fs from "node:fs";
import {writeFile} from "node:fs/promises";
import {ipcMain, dialog, type IpcMainEvent} from "electron";
import path from "node:path";
import {publicDirPath} from "./GetPublicPath";
import {projectIsValid} from "./ProjectValidator";
import {getProjectPath, setProjectPath, removeProjectPath} from "./Preferences";
import {sendProjectUI, sendAlertMessage, sendProjectPath} from "./WindowsUtilities";
import type {Project, ClientProjectInfo, ClientProjectInfoItem,
			 OneNodeInfo, CtrlParams, ProjectGraph} from "@/types";
import type {NodeCore} from "./NodeCore";

// NOTE 1) Add here the classes that define the nodes
import {CaptureView} from "../nodes/CaptureMedia";
import {ComputeBonds} from "../nodes/ComputeBonds";
import {ComputeFingerprints} from "../nodes/ComputeFingerprints";
import {ComputeSymmetries} from "../nodes/ComputeSymmetries";
import {DrawIsosurface} from "../nodes/DrawIsosurface";
import {DrawOrthoslice} from "../nodes/DrawOrthoslice";
import {DrawPolyhedra} from "../nodes/DrawPolyhedra";
import {DrawStructure} from "../nodes/DrawStructure";
import {DrawUnitCell} from "../nodes/DrawUnitCell";
import {InterpolateVolume} from "../nodes/InterpolateVolume";
import {Measures} from "../nodes/Measures";
import {StructureReader} from "../nodes/StructureReader";
import {StructureWriter} from "../nodes/StructureWriter";
import {Trajectories} from "../nodes/Trajectories";
import {Viewer3D} from "../nodes/Viewer3D";
import {DiffractionPattern} from "../nodes/DiffractionPattern";

/**
 * @notExported
 */
class ProjectManager {

    private static instance: ProjectManager;

	private readonly activeNodes = new Map<string, NodeCore>();
	private project: Project | undefined;
	private projectName = "";

	// NOTE 2) Add here the type of all nodes
	private readonly allNodes: OneNodeInfo[] = [

		{type: "structure-reader",     in: false, out: true,  graphic: "none", handler: StructureReader,
									   idPrefix: "reader",    ui: "StructureReaderCtrl"},
		{type: "compute-symmetries",   in: true,  out: true,  graphic: "none", handler: ComputeSymmetries,
									   idPrefix: "symmetry",  ui: "ComputeSymmetriesCtrl"},
		{type: "diffraction-pattern",  in: true,  out: false, graphic: "none", handler: DiffractionPattern,
									   idPrefix: "xray",      ui: "DiffractionPatternCtrl"},
		{type: "draw-structure",       in: true,  out: false, graphic: "out",  handler: DrawStructure,
									   idPrefix: "draw",      ui: "DrawStructureCtrl"},
		{type: "draw-unit-cell",       in: true,  out: true,  graphic: "out",  handler: DrawUnitCell,
									   idPrefix: "unit",      ui: "DrawUnitCellCtrl"},
		{type: "compute-bonds",        in: true,  out: true,  graphic: "none", handler: ComputeBonds,
									   idPrefix: "bonds",     ui: "ComputeBondsCtrl"},
		{type: "compute-fingerprints", in: true,  out: false, graphic: "none", handler: ComputeFingerprints,
									   idPrefix: "cfp",       ui: "ComputeFingerprintsCtrl"},
		{type: "isosurface",           in: true,  out: false, graphic: "out",  handler: DrawIsosurface,
									   idPrefix: "iso",       ui: "DrawIsosurfaceCtrl"},
		{type: "orthoslice",           in: true,  out: false, graphic: "out",  handler: DrawOrthoslice,
									   idPrefix: "ortho",     ui: "DrawOrthosliceCtrl"},
		{type: "draw-polyhedra",       in: true,  out: false, graphic: "out",  handler: DrawPolyhedra,
									   idPrefix: "polyhedra", ui: "DrawPolyhedraCtrl"},
		{type: "interpolate-volume",   in: true,  out: true,  graphic: "none", handler: InterpolateVolume,
									   idPrefix: "smooth",    ui: "InterpolateVolumeCtrl"},
		{type: "measures",             in: true,  out: false, graphic: "out",  handler: Measures,
									   idPrefix: "measure",   ui: "MeasuresCtrl"},
		{type: "structure-writer",     in: true,  out: false, graphic: "none", handler: StructureWriter,
									   idPrefix: "writer",    ui: "StructureWriterCtrl"},
		{type: "draw-trajectories",    in: true,  out: false, graphic: "out",  handler: Trajectories,
									   idPrefix: "trace",     ui: "TrajectoriesCtrl"},
		{type: "capture-view",         in: false, out: false, graphic: "none", handler: CaptureView,
									   idPrefix: "capture",   ui: "CaptureMediaCtrl"},
		{type: "viewer-3d",            in: false, out: false, graphic: "in",   handler: Viewer3D,
									   idPrefix: "viewer",    ui: "Viewer3DCtrl"},
	];
	private readonly allNodesMap = new Map<string, OneNodeInfo>();

	private constructor() {

		for(const entry of this.allNodes) {
			this.allNodesMap.set(entry.type, entry);
		}
	}

	/**
	* Read the given project, parse it and send it to client
	*
	* @param filename - Project file to be read
	*/
	loadProject(filename: string, isDefaultProject: boolean): void {

		// Clear a previous loaded project
		this.clearProject();

		this.projectName = isDefaultProject ? "" : path.basename(filename);

		try {
			const rawProject = fs.readFileSync(filename, "utf8");
			if(!rawProject) throw Error("Empty project file");
			this.project = JSON.parse(rawProject) as Project;
			this.parseProject();
		}
		catch(error) {
			sendAlertMessage(`Cannot read project file "${filename}". Error: ${(error as Error).message}`);
		}

		// Send the needed parts of the project to the client
		this.sendProject();
	}

	/**
	 * Send the needed parts of the project to the client
	 */
	sendProject(): void {

		sendProjectUI(this.project ? this.buildProjectInfo() : {});
	}

	/**
	 * Return the object to the initial status
	 */
	private clearProject(): void {

		this.project = undefined;
		this.activeNodes.clear();
	}

	/**
	 * Parse the project.
	 */
	private parseProject(): void {

		// Verify the project format is valid
		if(!this.project) throw Error("Invalid project loaded");
		if(!projectIsValid(this.project)) throw Error("Invalid project file format");

		// Store the nodes
		for(const entry in this.project.graph) {

			this.activeNodes.set(entry, this.nodeFactory(this.project.graph[entry].type, entry));
		}

		// Make connections
		for(const entry in this.project.graph) {

			// Verify list of id from which the entry takes values
			const {in: inString} = this.project.graph[entry];
			if(!inString) continue;

			const inNodes = inString.replaceAll(" ", "").split(",");
			if(inNodes.length === 0) continue;

			// The node that receive these input
			const node = this.activeNodes.get(entry)!;

			// For each input
			for(const inNode of inNodes) {

				const nodeIn = this.activeNodes.get(inNode);
				if(!nodeIn) throw Error(`Invalid input id "${inNode}" for "${entry}"`);
				nodeIn.subscribe(node.fromPreviousNode.bind(node));
			}
		}

		// Set node state
		for(const id in this.project.ui) {
			const node = this.activeNodes.get(id);
			if(!node) continue;

			node.loadStatus(this.project.ui[id]);
		}

		if(this.project.viewer) {

			for(const entry in this.project.graph) {
				if(this.project.graph[entry].type === "viewer-3d") {

					const node = this.activeNodes.get(entry);
					if(node) node.loadStatus(this.project.viewer);
				}
			}
		}
	}

	/**
	 * Instantiate the node of a given type
	 *
	 * @param nodeType - Type of the node to instantiate
	 * @param id - ID of the node to be instantiated
	 * @returns - One instantiation of the node
	 */
	private nodeFactory(nodeType: string, id: string): NodeCore {

		const node = this.allNodesMap.get(nodeType);
		if(!node) throw Error(`Invalid node type "${nodeType}"`);
		// eslint-disable-next-line sonarjs/new-cap
		return new node.handler(id);
	}

	/**
	 * Build a description of the project graph
	 *
	 * @returns Description of the project graph
	 */
	private buildProjectInfo(): ClientProjectInfo {

		const clientProjectInfo: ClientProjectInfo = {};

		if(!this.project) return {};

		for(const entry in this.project.graph) {

			const node = this.activeNodes.get(entry);
			if(!node) throw Error(`Invalid type "${entry}" in buildProjectInfo`);

			const {label, type, in: inString} = this.project.graph[entry];

			const uiInfo = this.allNodesMap.get(type);
			if(!uiInfo) throw Error(`Invalid type ${entry} in allNodeMap`);

			const info: ClientProjectInfoItem = {
				id: entry,
				label,
				type,
				input: inString ?? "",
				ui: uiInfo.ui,
				graphic: uiInfo.graphic,
			};
			clientProjectInfo[entry] = info;
		}

		return clientProjectInfo;
	}

	/**
	 * Prepare the project description for the project editor
	 *
	 * @returns JSON encoded project graph info
	 */
	projectGraphForEditor(): string {
		return JSON.stringify({graph: this.buildProjectInfo(), allNodes: this.allNodes});
	}

	/**
	 * Save the current project to the given file
	 *
	 * @param filename - Where the current project should be saved
	 */
	async saveProjectAs(filename: string): Promise<void> {

		if(!this.project) return;

		const formattedOut = await this.createProjectSave(this.project.graph);
		await writeFile(filename, formattedOut, "utf8");

		sendProjectPath(filename);
		setProjectPath(filename);
	}

	/**
	 * Save a loaded project
	 */
	saveProject(): void {

		const filename = getProjectPath();
		if(filename) void this.saveProjectAs(filename);
		else sendAlertMessage("Cannot save project. Filename not set");
	};

	/**
	 * Get the default project file path
	 *
	 * @returns Full path to the default project
	 */
	private getDefaultProject(): string {

		return publicDirPath("default-project.stm");
	}

	/**
	 * Read the given project, remember it and send it to client
	 *
	 * @param filename - Project file to be read
	 * @returns True if the loaded project is the default one
	 */
	loadProjectAndRemember(filename: string): boolean {

		let loadedDefaultProject = false;

		if(fs.existsSync(filename)) {

			setProjectPath(filename);
			sendProjectPath(filename);
		}
		else {
			sendAlertMessage(`Project file "${filename}" does not exist. Loading default project`);

			removeProjectPath();
			filename = this.getDefaultProject();
			sendProjectPath();
			loadedDefaultProject = true;
		}
		this.loadProject(filename, loadedDefaultProject);
		return loadedDefaultProject;
	};

	/**
	 * Read the saved project or the default one
	 *
	 * @param ignoreSaved - If true read only the default project and remove the saved project path
	 * @returns True if the loaded project is the default one
	 */
	loadRememberedProject(ignoreSaved: boolean): boolean {

		let filename;
		let loadedDefaultProject = false;
		if(ignoreSaved) {
			filename = this.getDefaultProject();
			removeProjectPath();
			sendProjectPath();
			loadedDefaultProject = true;
		}
		else {
			filename = getProjectPath();
			if(!filename) {
				filename = this.getDefaultProject();
				sendProjectPath();
				loadedDefaultProject = true;
			}
			if(fs.existsSync(filename)) sendProjectPath(filename);
			else {
				sendAlertMessage(`Project file "${filename}" does not exist. Loading default project`);
				removeProjectPath();
				filename = this.getDefaultProject();
				sendProjectPath();
				loadedDefaultProject = true;
			}
		}
		this.loadProject(filename, loadedDefaultProject);
		return loadedDefaultProject;
	}

	/**
	 * Return the project name
	 *
	 * @returns The project name or an empty string for the default project
	 */
	getProjectName(): string {
		return this.projectName;
	}

	/** The keys not to be written to the project file */
	private readonly keyToRemove = new Set(["id", "ui", "graphic"]);

	/**
	 * Create the project save from the project editor
	 *
	 * @param graph - Project graph from the project editor
	 * @returns The project file content to be saved
	 */
	// async createProjectSave(graph: ClientProjectInfo): Promise<string> {
	async createProjectSave(graph: ProjectGraph): Promise<string> {

		// Retrieve the state of the nodes
		let uiStatus = "";
		let viewerStatus;
		let notFirst = false;

		for(const entry in graph) {

			const node = this.activeNodes.get(entry)!;

			if(graph[entry].type === "viewer-3d") viewerStatus = await node.saveStatus();
			else {
				const statusToSave = node.saveStatus() as string;
				if(!statusToSave) continue;
				if(notFirst) uiStatus += ",";
				else notFirst = true;

				uiStatus += statusToSave;
			}
		}

		// Save the graph
		const graphAsString = JSON.stringify(graph, (key, value) => {
			if(key === "input" && value === "") return;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/consistent-return
			if(!this.keyToRemove.has(key)) return value;
		});

		// Prepare the output
		const out = viewerStatus ?
					`{"graph":${graphAsString},"viewer":${viewerStatus},"ui":{${uiStatus}}}` :
					`{"graph":${graphAsString},"ui":{${uiStatus}}}`;
		return `${JSON.stringify(JSON.parse(out), undefined, 2)}\n`;
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
    static getInstance(): ProjectManager {

        if(!ProjectManager.instance) {
            ProjectManager.instance = new ProjectManager();
        }

        return ProjectManager.instance;
    }
};

// > Access to the Project Manager
/** Access the Project Manager */
export const pm = ProjectManager.getInstance();

/**
 * Setup channel to request project data
 */
export const setupChannelProject = (): void => {

	ipcMain.on("SYSTEM:project", () => {

		pm.sendProject();
	});

	ipcMain.on("SYSTEM:modified-project", (_event: IpcMainEvent, params: CtrlParams): void => {

		const prj = params.projectModified as string;
		if(!prj) return;

		const file = dialog.showSaveDialogSync({
			title: "Save modified project",
			filters: [
				{name: "STMng project", extensions: ["stm"]},
			]
		});
		if(file) {

			const graph = JSON.parse(prj) as ClientProjectInfo;

			pm.createProjectSave(graph)
				.then((content) => {
					fs.writeFileSync(file, content, "utf8");
				})
				.catch((error: Error) => {
					sendAlertMessage(`Cannot write modified project file. Error: ${(error as Error).message}`);
				});
		}
	});
};
