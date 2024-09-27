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
import {ipcMain} from "electron";
import path from "node:path";
import {publicDirPath} from "./GetPublicPath";

import type {NodeCore} from "./NodeCore";
import {projectIsValid} from "./ProjectValidator";
import {getProjectPath, setProjectPath, removeProjectPath} from "./Preferences";
import {sendProjectUI, sendAlertMessage, sendProjectPath} from "./WindowsUtilities";
import type {Project, ClientProjectInfo, ClientProjectInfoItem} from "@/types";

// NOTE 1) Add here the classes that defines the nodes
import {CaptureView} from "../nodes/CaptureMedia";
import {ChartViewer} from "../nodes/ChartViewer";
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

/**
 * @notExported
 */
class ProjectManager {

    private static instance: ProjectManager;

	private readonly nodes = new Map<string, NodeCore>();
	private project: Project | undefined;
	private projectName = "";

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
		this.nodes.clear();
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

			this.nodes.set(entry, this.nodeFactory(this.project.graph[entry].type, entry));
		}

		// Make connections
		for(const entry in this.project.graph) {

			// Verify list of id from which the entry takes values
			const {in: inString} = this.project.graph[entry];
			if(!inString) continue;

			const inNodes = inString.replaceAll(" ", "").split(",");
			if(inNodes.length === 0) continue;

			// The node that receive these input
			const node = this.nodes.get(entry)!;

			// For each input
			for(const inNode of inNodes) {

				const nodeIn = this.nodes.get(inNode);
				if(!nodeIn) throw Error(`Invalid input id "${inNode}" for "${entry}"`);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				nodeIn.subscribe(node.notifier, node);
				// nodeIn.subscribe(node.notifier.bind(node), node);
			}
		}

		// Set node state
		for(const id in this.project.ui) {
			const node = this.nodes.get(id);
			if(!node) continue;

			node.loadStatus(this.project.ui[id]);
		}

		if(this.project.viewer) {

			for(const entry in this.project.graph) {
				if(this.project.graph[entry].type === "viewer-3d") {

					const node = this.nodes.get(entry);
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

		// NOTE 2) Add node class instantiation
		switch(nodeType) {
			case "structure-reader":
				return new StructureReader(id);
			case "compute-symmetries":
				return new ComputeSymmetries(id);
			case "draw-structure":
				return new DrawStructure(id);
			case "draw-unit-cell":
				return new DrawUnitCell(id);
			case "chart-viewer":
				return new ChartViewer(id);
			case "compute-bonds":
				return new ComputeBonds(id);
			case "compute-fingerprints":
				return new ComputeFingerprints(id);
			case "isosurface":
				return new DrawIsosurface(id);
			case "orthoslice":
				return new DrawOrthoslice(id);
			case "draw-polyhedra":
				return new DrawPolyhedra(id);
			case "interpolate-volume":
				return new InterpolateVolume(id);
			case "measures":
				return new Measures(id);
			case "structure-writer":
				return new StructureWriter(id);
			case "draw-trajectories":
				return new Trajectories(id);
			case "viewer-3d":
				return new Viewer3D(id);
			case "capture-view":
				return new CaptureView(id);
			default:
				throw Error(`Invalid node type ${nodeType}`);
		}
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

			const node = this.nodes.get(entry);
			if(!node) throw Error(`Invalid type "${entry}" in buildProjectInfo`);

			const {label, type, in: inString} = this.project.graph[entry];
			const inNodes = inString ? inString.replaceAll(" ", "").split(",") : [];

			const uiInfo = node.getUiInfo();
			const info: ClientProjectInfoItem = {
				id: entry,
				label,
				type,
				input: inNodes,
				ui: uiInfo.ui,
				graphic: uiInfo.graphic,
				channels: uiInfo.channels,
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
		return JSON.stringify(this.buildProjectInfo());
	}

	/**
	 * Save the current project to the given file
	 *
	 * @param filename - Where the current project should be saved
	 */
	async saveProjectAs(filename: string): Promise<void> {

		if(!this.project) return;

		// Retrieve the state of the nodes
		let uiStatus = "";
		let viewerStatus;
		let notFirst = false;

		for(const entry in this.project.graph) {

			const node = this.nodes.get(entry)!;

			if(this.project.graph[entry].type === "viewer-3d") viewerStatus = await node.saveStatus();
			else {
				const statusToSave = node.saveStatus() as string;
				if(!statusToSave) continue;
				if(notFirst) uiStatus += ",";
				else notFirst = true;

				uiStatus += statusToSave;
			}
		}

		// Save the graph
		const graphAsString = JSON.stringify(this.project.graph);

		// Prepare the output and write it
		const out = viewerStatus ?
					`{"graph":${graphAsString},"viewer":${viewerStatus},"ui":{${uiStatus}}}` :
					`{"graph":${graphAsString},"ui":{${uiStatus}}}`;
		const formattedOut = `${JSON.stringify(JSON.parse(out), undefined, 2)}\n`;
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
};
