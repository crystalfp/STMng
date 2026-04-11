/**
 * Load and store the visualized project, that is, the set of
 * interconnected nodes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-06
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {readFileSync, writeFileSync, statSync, existsSync} from "node:fs";
import {writeFile} from "node:fs/promises";
import {ipcMain, dialog, shell} from "electron";
import path from "node:path";
import log from "electron-log";
import {publicDirPath} from "./GetPublicPath";
import {projectIsValid} from "./ProjectValidator";
import {getProjectPath, setProjectPath, removeProjectPath} from "./Preferences";
import {sendProjectUI, sendAlertToClient, sendProjectPath} from "./ToClient";
import {disableSaveProjectEntry} from "./SystemMenu";
import type {Project, CtrlParams, ProjectGraph} from "@/types";
import type {ClientProjectInfo, ClientProjectInfoItem, OneNodeInfo} from "@/types/NodeInfo";
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
import {StructureBackbone} from "../nodes/StructureBackbone";
import {SliceStructure} from "../nodes/SliceStructure";
import {VariableComposition} from "../nodes/VariableComposition";
import {FindSimilar} from "../nodes/FindSimilar";

/**
 * Manage everything related to the loaded project
 * @notExported
 */
class ProjectManager {

    private static instance: ProjectManager;

	private readonly activeNodes = new Map<string, NodeCore>();
	private project: Project | undefined;
	private projectName = "";
	private readonly allNodesMap = new Map<string, OneNodeInfo>();

	// NOTE 2) Add here the type of all nodes
	private readonly allNodes: OneNodeInfo[] = [

		{type: "structure-reader",		in: false, out: true, graphic: "none",
										handler: StructureReader,
										idPrefix: "reader",    ui: "StructureReaderCtrl"},
		{type: "structure-backbone",   	in: true,  out: false, graphic: "out",
										handler: StructureBackbone,
									   	idPrefix: "backbone",  ui: "StructureBackboneCtrl"},
		{type: "compute-symmetries",   	in: true,  out: true, graphic: "none",
										handler: ComputeSymmetries,
									   	idPrefix: "symmetry",  ui: "ComputeSymmetriesCtrl"},
		{type: "diffraction-pattern",  	in: true,  out: false, graphic: "none",
										handler: DiffractionPattern,
									   	idPrefix: "xray",      ui: "DiffractionPatternCtrl"},
		{type: "draw-structure",       	in: true,  out: false, graphic: "out",
										handler: DrawStructure,
									   	idPrefix: "draw",      ui: "DrawStructureCtrl"},
		{type: "draw-unit-cell",       	in: true,  out: true,  graphic: "out",
										handler: DrawUnitCell,
									   	idPrefix: "unit",      ui: "DrawUnitCellCtrl"},
		{type: "compute-bonds",        	in: true,  out: true, graphic: "none",
										handler: ComputeBonds,
									   	idPrefix: "bonds",     ui: "ComputeBondsCtrl"},
		{type: "compute-fingerprints", 	in: true,  out: false, graphic: "none",
										handler: ComputeFingerprints,
									   	idPrefix: "cfp",       ui: "ComputeFingerprintsCtrl"},
		{type: "isosurface",           	in: true,  out: false, graphic: "out",
										handler: DrawIsosurface,
									   	idPrefix: "iso",       ui: "DrawIsosurfaceCtrl"},
		{type: "orthoslice",           	in: true,  out: false, graphic: "out",
										handler: DrawOrthoslice,
									   	idPrefix: "ortho",     ui: "DrawOrthosliceCtrl"},
		{type: "draw-polyhedra",       	in: true,  out: false, graphic: "out",
										handler: DrawPolyhedra,
									   	idPrefix: "polyhedra", ui: "DrawPolyhedraCtrl"},
		{type: "interpolate-volume",   	in: true,  out: true, graphic: "none",
										handler: InterpolateVolume,
									   	idPrefix: "smooth",    ui: "InterpolateVolumeCtrl"},
		{type: "slice-structure",      	in: true,  out: true, graphic: "out",
										handler: SliceStructure,
									   	idPrefix: "slice",     ui: "SliceStructureCtrl"},
		{type: "measures",             	in: true,  out: false, graphic: "out",
										handler: Measures,
									   	idPrefix: "measure",   ui: "MeasuresCtrl"},
		{type: "structure-writer",     	in: true,  out: false, graphic: "none",
										handler: StructureWriter,
									   	idPrefix: "writer",    ui: "StructureWriterCtrl"},
		{type: "draw-trajectories",    	in: true,  out: true, graphic: "out",
										handler: Trajectories,
									   	idPrefix: "trace",     ui: "TrajectoriesCtrl"},
		{type: "capture-view",         	in: false, out: false, graphic: "none",
										handler: CaptureView,
									   	idPrefix: "capture",   ui: "CaptureMediaCtrl"},
		{type: "viewer-3d",            	in: false, out: false, graphic: "in",
										handler: Viewer3D,
									   	idPrefix: "viewer",    ui: "Viewer3DCtrl"},
		{type: "find-similar",			in: true,  out: false, graphic: "none",
										handler: FindSimilar,
									   	idPrefix: "similar", ui: "FindSimilarCtrl"},
		{type: "variable-composition",  in: true,  out: false, graphic: "none",
										handler: VariableComposition,
									   	idPrefix: "variable", ui: "VariableCompositionCtrl"},
	];

	/**
	 * Convert the list of node types into a map for performance
	 */
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
			const rawProject = readFileSync(filename, "utf8");
			if(!rawProject) throw Error("Empty project file");
			this.project = JSON.parse(rawProject) as Project;
			this.parseProject();

			// Send the needed parts of the project to the client
			this.sendProject();
		}
		catch(error) {
			sendAlertToClient(`Cannot read project file "${filename}". Error: ${(error as Error).message}`);
		}
	}

	/**
	 * Send the needed parts of the project to the client
	 */
	sendProject(): void {

		let projectInfo: ClientProjectInfo = {};
		if(this.project) {
			try {
				projectInfo = this.buildProjectInfo();
			}
			catch(error) {
				sendAlertToClient(`Cannot parse project for send. Error: ${(error as Error).message}`);
			}
		}

		sendProjectUI(projectInfo);
	}

	/**
	 * Return the object to the initial status
	 */
	private clearProject(): void {

		this.project = undefined;
		this.activeNodes.clear();
	}

	/**
	 * Parse the project
	 *
	 * @throws Error.
	 * "Invalid project loaded" or "Invalid project file format" or "Invalid input id"
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
	 * @throws Error. "Invalid node type"
	 */
	private nodeFactory(nodeType: string, id: string): NodeCore {

		const node = this.allNodesMap.get(nodeType);
		if(!node) throw Error(`Invalid node type "${nodeType}"`);
		return new node.handler(id);
	}

	/**
	 * Build a description of the project graph
	 *
	 * @returns Description of the project graph
	 * @throws Error. "Invalid type" or "Invalid type in allNodeMap"
	 */
	private buildProjectInfo(): ClientProjectInfo {

		const clientProjectInfo: ClientProjectInfo = {};

		if(!this.project) return {};

		for(const entry in this.project.graph) {

			const node = this.activeNodes.get(entry);
			if(!node) throw Error(`Invalid type "${entry}" in buildProjectInfo`);

			const {label, type, in: inString, x, y} = this.project.graph[entry];

			const uiInfo = this.allNodesMap.get(type);
			if(!uiInfo) throw Error(`Invalid type ${entry} in allNodeMap`);

			const info: ClientProjectInfoItem = {
				id: entry,
				label,
				type,
				in: inString ?? "",
				ui: uiInfo.ui,
				graphic: uiInfo.graphic,
				x,
				y
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

		let projectInfo: ClientProjectInfo;
		try {
			projectInfo = this.buildProjectInfo();
		}
		catch(error) {
			sendAlertToClient(`Cannot parse project. Error: ${(error as Error).message}`);
			return "";
		}

		return JSON.stringify({
			graph: projectInfo,
			allNodes: this.allNodes,
			projectPath: getProjectPath()
		});
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
		else sendAlertToClient("Cannot save project. Filename not set");
	}

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

		const fstat = statSync(filename, {throwIfNoEntry: false});
		if(!fstat?.isFile() || fstat.size === 0) {
			sendAlertToClient(`Project file "${filename}" does not exist or is invalid. Loading default project`);

			removeProjectPath();
			filename = this.getDefaultProject();
			sendProjectPath();
			loadedDefaultProject = true;
		}
		else {

			setProjectPath(filename);
			sendProjectPath(filename);
		}
		this.loadProject(filename, loadedDefaultProject);
		return loadedDefaultProject;
	}

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
			if(filename) {
				const fstat = statSync(filename, {throwIfNoEntry: false});
				if(fstat?.isFile() && fstat.size > 0) {
					sendProjectPath(filename);
				}
				else {
					sendAlertToClient(`Project file "${filename}" does not exist or is invalid. Loading default project`);
					removeProjectPath();
					filename = this.getDefaultProject();
					sendProjectPath();
					loadedDefaultProject = true;
				}
			}
			else {
				filename = this.getDefaultProject();
				sendProjectPath();
				loadedDefaultProject = true;
				sendProjectPath(filename);
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
	async createProjectSave(graph: ProjectGraph): Promise<string> {

		// Retrieve the state of the nodes
		let uiStatus = "";
		let viewerStatus;
		let notFirst = false;

		for(const entry in graph) {

			// Access the node or create it if new
			let node;
			if(this.activeNodes.has(entry)) {
				node = this.activeNodes.get(entry)!;
			}
			else {
				node = this.nodeFactory(graph[entry].type, entry);
				this.activeNodes.set(entry, node);
			}

			// Get the node status
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
			if(key === "in" && value === "") return;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			if(!this.keyToRemove.has(key)) return value; // oxlint-disable-line @typescript-eslint/consistent-return
		});

		// Prepare the output
		const out = viewerStatus ?
					`{"graph":${graphAsString},"viewer":${viewerStatus},"ui":{${uiStatus}}}` :
					`{"graph":${graphAsString},"ui":{${uiStatus}}}`;
		return `${JSON.stringify(JSON.parse(out), undefined, 2)}\n`;
	}

	/**
	 * Get node description
	 *
	 * @param key - Type of the node
	 * @returns The short description of the node
	 */
	getDescription(key: string): string {

		const entry = this.allNodesMap.get(key);
		if(!entry) return `Missing description for node "${key}"`;
		const node = new entry.handler(key);
		return node.description();
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
}

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

	ipcMain.handle("SYSTEM:modified-project", (_event, params: CtrlParams) => {

		const prj = params.projectModified as string;
		if(!prj) return {saved: false};

		const currentFilename = params.projectPath as string;

		const file = currentFilename || dialog.showSaveDialogSync({
			title: "Save modified project",
			filters: [
				{name: "STMng project", extensions: ["stm"]},
			]
		});
		if(file) {

			const graph = JSON.parse(prj) as ClientProjectInfo;

			pm.createProjectSave(graph)
				.then((content) => {
					writeFileSync(file, content, "utf8");
					pm.loadProjectAndRemember(file);
					disableSaveProjectEntry(false);
				})
				.catch((error: Error) => {
					sendAlertToClient(`Cannot write modified project file. Error: ${error.message}`);
				});
		}
		else return {saved: false};

		return {saved: true};
	});

	ipcMain.handle("SYSTEM:description", (_event, params: CtrlParams) => {

		const key = params.key as string;

		return {description: key ? pm.getDescription(key) : "No description available"};
	});

	ipcMain.on("SYSTEM:node-help", (_event, params: CtrlParams) => {

		const file = params.key as string;
		if(!file) return;

		const url = publicDirPath(`doc/nodes/${file}.html`, true);
		if(existsSync(url)) {
			shell.openPath(url)
				.then((sts) => {
					if(sts) throw Error(sts);
				})
				.catch((error: Error) => {
					log.error(`Error from help file "${file}.html": ${error.message}`);
				});
		}
		else {
			log.error(`Help file "${file}.html" not found`);
		}
	});
};
