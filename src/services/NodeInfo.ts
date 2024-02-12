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
import {DrawHelpers} from "@/nodes/DrawHelpers";
import {DrawPolyhedra} from "@/nodes/DrawPolyhedra";
import {ChartViewer} from "@/nodes/ChartViewer";
import {ApplySymmetries} from "@/nodes/ApplySymmetries";
import {FindSymmetries} from "@/nodes/FindSymmetries";

interface NodeParts {
	ui: string;
}

export class NodeInfo {

	// NOTE 2) Add the type and its ui component
	private static readonly typeToPartsRecord: Record<string, NodeParts> = {
		"structure-reader":	{ui: "StructureReaderCtrl"},
		"draw-structure":	{ui: "DrawStructureCtrl"},
		"draw-unit-cell":	{ui: "DrawUnitCellCtrl"},
		"draw-helpers":		{ui: "DrawHelpersCtrl"},
		"chart-viewer":		{ui: "ChartViewerCtrl"},
		"viewer-3d":   		{ui: "Viewer3DCtrl"},
		"draw-polyhedra":   {ui: "DrawPolyhedraCtrl"},
		"capture-view":   	{ui: "CaptureMediaCtrl"},
		"apply-symmetries": {ui: "ApplySymmetriesCtrl"},
		"find-symmetries": 	{ui: "FindSymmetriesCtrl"},
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
	 * @returns Info on the node
	 */
	getUICode(node: GraphNode): NodeUI | undefined {

		const info = this.typeToParts.get(node.type);
		return info ? {id: node.id, ui: info.ui, label: node.label, in: node.in} : undefined;
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
			case "draw-helpers":
				map.set(id, new DrawHelpers(id));
				break;
			case "draw-polyhedra":
				map.set(id, new DrawPolyhedra(id));
				break;
			case "apply-symmetries":
				map.set(id, new ApplySymmetries(id));
				break;
			case "find-symmetries":
				map.set(id, new FindSymmetries(id));
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
			case "apply-symmetries":
			case "find-symmetries":
			case "draw-unit-cell":
			case "structure-reader": {
				const typedData = data as Structure;
				const typedStore = dataInStore as Structure;
				typedStore.crystal = typedData.crystal;
				typedStore.atoms = typedData.atoms;
				typedStore.bonds = typedData.bonds;
				typedStore.look = typedData.look;

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
			case "apply-symmetries":
			case "find-symmetries":
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
	 * @returns - Formatted status as a JSON string
	 */
	saveUiStatus(map: Map<string, unknown>, idToType: Map<string, string>): string {

		let uiStatus = '"ui":{';
		let notFirst = false;
		for(const [id, node] of map) {

			const type = idToType.get(id);

			// NOTE 6) Add here the node UI status save. Viewer-3d and capture-view don't belongs here.
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
				case "draw-helpers":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as DrawHelpers).saveStatus();
					break;
				case "draw-polyhedra":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as DrawPolyhedra).saveStatus();
					break;
				case "apply-symmetries":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as ApplySymmetries).saveStatus();
					break;
				case "find-symmetries":
					if(notFirst) uiStatus += ",";
					uiStatus += (node as FindSymmetries).saveStatus();
					break;
			}
			notFirst = true;
		}
		uiStatus += "}";

		return uiStatus;
	}
}
