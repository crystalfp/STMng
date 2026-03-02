/**
 * Types definitions related to NodeCore.
 * They have been splitted from the main file to avoid circular dependencies.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-24
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
import type {NodeCore} from "@/electron/modules/NodeCore";

// > User interface info

/** Description of the node graphical output:
 *  - "out": generates graphical output
 *  - "in": the viewer
 *  - "none": is pure computation
 */
export type GraphicType = "none" | "in" | "out";

// > Project information to the client
/** One UI module description */
export interface ClientProjectInfoItem {

	/** ID of the node */
	id: string;

	/** The label that appears on the node selector */
	label: string;

	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

	/** Node id from which the node takes input. If none, it is the empty string */
	in: string;

	/** The name of the node ui component */
	ui: string;

	/** Which kind of graphical object this node generates or consume */
	graphic: GraphicType;

    /** X position on the graph editor */
	x?: number;

	/** Y position on the graph editor */
	y?: number;
}

/** Description of one available node */
export interface OneNodeInfo {

	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

	/** True if the node accepts an input structure */
	in: boolean;

	/** True if the node send a structure down the pipeline */
	out: boolean;

	/** True if the output could remain unconnected */
	opt: boolean;

	/** "out": generates graphical output, "in": the viewer, "none": is pure computation */
	graphic: GraphicType;

	/** Prefix for the automatically generate id by project editor */
	idPrefix: string;

	/** The name of the node ui component */
	ui: string;

	/** The class that will be instanced if the node is active */
	handler: {
		/** Class constructor */
		new (id: string): NodeCore; // eslint-disable-line @typescript-eslint/prefer-function-type
	};
}

/** List of ui modules descriptions to the client */
export type ClientProjectInfo = Record<string, ClientProjectInfoItem>;

/** Project data to the project editor */
export interface ProjectInfo {

	/** Project content */
	graph: ClientProjectInfo;

	/** All available nodes info */
	allNodes: OneNodeInfo[];

	/** Currently loaded project file path or empty string if default project */
	projectPath: string;
}
