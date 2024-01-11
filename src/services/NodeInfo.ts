import log from "electron-log";

import {StructureReader} from "@/nodes/StructureReader";
import {DrawStructure} from "@/nodes/DrawStructure";
import {DrawUnitCell} from "@/nodes/DrawUnitCell";
import {DrawHelpers} from "@/nodes/DrawHelpers";
import {DrawPolyhedra} from "@/nodes/DrawPolyhedra";
import {ChartViewer} from "@/nodes/ChartViewer";
import type {GraphNode} from "@/services/Validators";
import type {NodeUI} from "@/types";

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
				// The viewer has no runtime code like the others
				break;
			default:
				log.error(`Invalid type "${type}" setting runtime for "${id}"`);
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

	restoreUiStatus(savedStatus: string): void {

		// TBD
		void savedStatus;
	}
}
