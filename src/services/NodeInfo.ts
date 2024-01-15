import log from "electron-log";
import {watch} from "vue";
import {StructureReader} from "@/nodes/StructureReader";
import {DrawStructure} from "@/nodes/DrawStructure";
import {DrawUnitCell} from "@/nodes/DrawUnitCell";
import {DrawHelpers} from "@/nodes/DrawHelpers";
import {DrawPolyhedra} from "@/nodes/DrawPolyhedra";
import {ChartViewer} from "@/nodes/ChartViewer";
import type {NodeUI, Structure, GraphNode} from "@/types";

interface NodeParts {
	ui: string;
}

export class NodeInfo {

	private static readonly typeToPartsRecord: Record<string, NodeParts> = {
		"structure-reader":	{ui: "StructureReaderCtrl"},
		"draw-structure":	{ui: "DrawStructureCtrl"},
		"draw-unit-cell":	{ui: "DrawUnitCellCtrl"},
		"draw-helpers":		{ui: "DrawHelpersCtrl"},
		"chart-viewer":		{ui: "ChartViewerCtrl"},
		"viewer-3d":   		{ui: "Viewer3DCtrl"},
		"draw-polyhedra":   {ui: "DrawPolyhedraCtrl"},
		"capture-view":   	{ui: "CapturerCtrl"},
	};
	private readonly typeToParts = new Map<string, NodeParts>();

	constructor() {

		// Setup the mapping between the node type and the node ui component
		for(const key in NodeInfo.typeToPartsRecord) {
			this.typeToParts.set(key, NodeInfo.typeToPartsRecord[key]);
		}
	}

	getUICode(node: GraphNode): NodeUI | undefined {

		const info = this.typeToParts.get(node.type);
		return info ? {id: node.id, ui: info.ui, label: node.label, in: node.in} : undefined;
	}

	setupRuntime(type: string, id: string, map: Map<string, unknown>): void {

		// TODO Here add the other types
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
			case "viewer-3d":
			case "capture-view":
				// These nodes have no runtime code like the others
				break;
			default:
				log.error(`Invalid type "${type}" setting runtime for "${id}"`);
		}
	}

	setDataInputs(id: string, type: string | undefined, data: unknown, dataInStore: unknown): void {

		// TODO Here add the other types
		switch(type) {
			case "structure-reader": {
				const typedData = data as Structure;
				const typedStore = dataInStore as Structure;
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

	getDataInputs(id: string,
				  type: string | undefined,
				  idFrom: string,
				  dataFrom: unknown,
				  callback: (data: unknown, idFrom: string) => void): void {

		// TODO Here add the other types
		switch(type) {
			case "structure-reader":
				watch(dataFrom as Structure, () => callback(dataFrom, idFrom), {deep: true});
				callback(dataFrom, idFrom);
				break;
			case "chart-viewer":
				break;
			case undefined:
				log.error(`Unknown id "${id}"`);
				break;
			default:
				log.error(`Cannot use getData with type "${type}" id: "${id}"`);
		}
	}

	saveUiStatus(map: Map<string, unknown>, idToType: Map<string, string>): string {

		let uiStatus = '"ui":{';
		let notFirst = false;
		for(const [id, node] of map) {

			const type = idToType.get(id);

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
			}
			notFirst = true;
		}
		uiStatus += "}";

		return uiStatus;
	}
}
