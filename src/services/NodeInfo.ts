import log from "electron-log";

import {StructureReader} from "@/services/StructureReader";
import {DrawStructure} from "@/services/DrawStructure";
import {DrawUnitCell} from "@/services/DrawUnitCell";
import {DrawHelpers} from "@/services/DrawHelpers";
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
		"chart-viewer":		{ui: "ChartDialogCtrl"},
		"viewer-3d":   		{ui: "Viewer3DCtrl"},
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
			case "viewer-3d":
				break;
			case "chart-viewer":
				break;
			case "draw-unit-cell":
				map.set(id, new DrawUnitCell(id));
				break;
			case "draw-helpers":
				map.set(id, new DrawHelpers(id));
				break;
			default:
				log.error(`Invalid type "${type}" setting runtime for "${id}"`);
		}
	}
}
