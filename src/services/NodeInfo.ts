/**
 * Everything related to nodes and their UI interfaces.
 *
 * @packageDocumentation
 *
 * @remarks
 * The points to modify to add a new node are marked using a NOTE comment.
 */
import {watch} from "vue";
import type {NodeUI, Structure, GraphNode} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";

// NOTE 1) Add here the class that defines the node
import {StructureReader} from "@/nodes/StructureReader";
import {DrawStructure} from "@/nodes/DrawStructure";
import {DrawUnitCell} from "@/nodes/DrawUnitCell";
import {DrawPolyhedra} from "@/nodes/DrawPolyhedra";
import {ChartViewer} from "@/nodes/ChartViewer";
import {Symmetries} from "@/nodes/Symmetries";
import {ComputeBonds} from "@/nodes/ComputeBonds";
import {Orthoslice} from "@/nodes/Orthoslice";
import {StructureWriter} from "@/nodes/StructureWriter";
import {Measures} from "@/nodes/Measures";
import {Trajectories} from "@/nodes/Trajectories";

interface NodeParts {
	ui: string;						// The name of the node ui component
	graphic: "none" | "in" | "out";	// "out" generates graphical output, "in" the viewer
}

export class NodeInfo {

	// NOTE 2) Add the type, its ui component and if create graphical object
	private static readonly typeToPartsRecord: Record<string, NodeParts> = {
		"structure-reader":		{ui: "StructureReaderCtrl",	graphic: "none"},
		"draw-structure":		{ui: "DrawStructureCtrl",	graphic: "out"},
		"draw-unit-cell":		{ui: "DrawUnitCellCtrl",	graphic: "out"},
		"chart-viewer":			{ui: "ChartViewerCtrl",		graphic: "none"},
		"viewer-3d":   			{ui: "Viewer3DCtrl",		graphic: "in"},
		"draw-polyhedra":   	{ui: "DrawPolyhedraCtrl",	graphic: "out"},
		"capture-view":   		{ui: "CaptureMediaCtrl",	graphic: "none"},
		"compute-symmetries": 	{ui: "SymmetriesCtrl",		graphic: "none"},
		"compute-bonds": 		{ui: "ComputeBondsCtrl",	graphic: "none"},
		"orthoslice":			{ui: "OrthosliceCtrl",		graphic: "out"},
		"structure-writer":		{ui: "StructureWriterCtrl",	graphic: "none"},
		"measures":				{ui: "MeasuresCtrl",		graphic: "out"},
		"draw-trajectories":	{ui: "TrajectoriesCtrl",	graphic: "out"},
	};
	private readonly typeToParts = new Map<string, NodeParts>();

	/**
	 * Initialize the type to parts map
	 */
	constructor() {

		// Setup the mapping between the node type and the node ui component
		for(const key in NodeInfo.typeToPartsRecord) {
			this.typeToParts.set(key, NodeInfo.typeToPartsRecord[key]);
		}
	}

	/**
	 * Return node info
	 *
	 * @param node - Node in the graph
	 * @returns Info about the node
	 */
	getNodeUI(id: string, node: GraphNode): NodeUI | undefined {

		const info = this.typeToParts.get(node.type);
		return info ? {id, ui: info.ui, label: node.label, in: node.in} : undefined;
	}

	/**
	 * Setup the node instances
	 *
	 * @param type - Type of the node
	 * @param id - ID of the node
	 * @param map - Map to be filled
	 */
	setupRuntime(type: string, id: string, map: Map<string, unknown>): void {

		// NOTE 3) Add node class instantiation
		switch(type) {
			case "structure-reader":
				map.set(id, new StructureReader(id));
				break;
			case "draw-structure":
				map.set(id, new DrawStructure(id));
				break;
			case "chart-viewer":
				map.set(id, new ChartViewer(id));
				break;
			case "draw-unit-cell":
				map.set(id, new DrawUnitCell(id));
				break;
			case "draw-polyhedra":
				map.set(id, new DrawPolyhedra(id));
				break;
			case "compute-symmetries":
				map.set(id, new Symmetries(id));
				break;
			case "compute-bonds":
				map.set(id, new ComputeBonds(id));
				break;
			case "orthoslice":
				map.set(id, new Orthoslice(id));
				break;
			case "structure-writer":
				map.set(id, new StructureWriter(id));
				break;
			case "measures":
				map.set(id, new Measures(id));
				break;
			case "draw-trajectories":
				map.set(id, new Trajectories(id));
				break;
			case "viewer-3d":
			case "capture-view":
				// These nodes have no runtime code like the others
				break;
			default:
				showErrorNotification(`Invalid type "${type}" in setting runtime for "${id}"`);
		}
	}

	/**
	 * Setup the output of a node
	 *
	 * @param id - ID of the node that generates an output
	 * @param type - Type of the node
	 * @param data - Data to output
	 * @param dataInStore - Data to put in the switchboard store
	 */
	setDataOutputs(id: string, type: string | undefined, data: unknown, dataInStore: unknown): void {

		// NOTE 4) Add the node types that generate an output
		switch(type) {

			// Nodes that have an output
			case "compute-symmetries":
			case "compute-bonds":
			case "draw-unit-cell":
			case "structure-reader": {
				const typedData = data as Structure;
				const typedStore = dataInStore as Structure;
				typedStore.crystal = typedData.crystal;
				typedStore.atoms   = typedData.atoms;
				typedStore.bonds   = typedData.bonds;
				typedStore.look    = typedData.look;
				typedStore.volume  = typedData.volume;

				break;
			}

			// Error handling
			case undefined:
				showErrorNotification(`Unknown id "${id}"`);
				break;
			default:
				showErrorNotification(`Cannot use setData with type "${type}" from id: "${id}"`);
				break;
		}
	}

	/**
	 * Get the input data
	 *
	 * @param id - ID of the node that receive an input
	 * @param type - Type of the node
	 * @param idFrom - From which node it takes the input
	 * @param dataFrom - Data in input
	 * @param callback - Function to be called when the node receive new data
	 */
	getDataInputs(id: string,
				  type: string | undefined,
				  idFrom: string,
				  dataFrom: unknown,
				  callback: (data: unknown, idFrom: string) => void): void {

		// NOTE 5) Add the node types from which other nodes could take an input
		switch(type) {

			// Nodes from which other nodes could take an input
			case "draw-unit-cell":
			case "structure-reader":
			case "compute-bonds":
			case "compute-symmetries":
				watch(dataFrom as Structure, () => callback(dataFrom, idFrom), {deep: true});
				callback(dataFrom, idFrom);
				break;

			// Error handling
			case undefined:
				showErrorNotification(`Unknown id "${id}"`);
				break;
			default:
				showErrorNotification(`Cannot use getData with type "${type}" id: "${id}"`);
				break;
		}
	}

	/**
	 * Save the status of all nodes
	 *
	 * @param map - Map of the nodes
	 * @param idToType - Map from node id to its type
	 * @returns Formatted status as a JSON string
	 */
	saveUiStatus(map: Map<string, unknown>, idToType: Map<string, string>): string {

		let uiStatus = '"ui":{';
		let notFirst = false;
		for(const [id, node] of map) {

			const type = idToType.get(id);

			// NOTE 6) Add here the node UI status save. Viewer-3d and capture-view don't belong here.
			switch(type) {
				case "structure-reader":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as StructureReader).saveStatus();
					break;
				case "draw-structure":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as DrawStructure).saveStatus();
					break;
				case "chart-viewer":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as ChartViewer).saveStatus();
					break;
				case "draw-unit-cell":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as DrawUnitCell).saveStatus();
					break;
				case "draw-polyhedra":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as DrawPolyhedra).saveStatus();
					break;
				case "compute-symmetries":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as Symmetries).saveStatus();
					break;
				case "compute-bonds":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as ComputeBonds).saveStatus();
					break;
				case "orthoslice":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as Orthoslice).saveStatus();
					break;
				case "structure-writer":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as StructureWriter).saveStatus();
					break;
				case "draw-trajectories":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as Trajectories).saveStatus();
					break;
			}
			notFirst = true;
		}
		uiStatus += "}";

		return uiStatus;
	}

	/**
	 * Get the type of the Viewer3D
	 *
	 * @returns The type of the viewer node
	 */
	getViewerType(): string {

		for(const key in NodeInfo.typeToPartsRecord) {
			const nodeParts = NodeInfo.typeToPartsRecord[key];
			if(nodeParts.graphic === "in") return key;
		}
		return "";
	}

	/**
	 * Check if the node generates also graphical output
	 *
	 * @param type - Type of the node
	 * @returns True if the node generates also graphical output that goes directly to the scene
	 */
	generatesGraphics(type: string): boolean {
		const nodeParts = NodeInfo.typeToPartsRecord[type];
		return nodeParts?.graphic === "out";
	}

	/**
	 * Check node type existence
	 *
	 * @param type - Node type to check
	 * @returns True if the node type exists
	 */
	checkType(type: string): boolean {
		return this.typeToParts.has(type);
	}
}
