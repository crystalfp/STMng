/**
 * Types definitions related to NodeCore.
 * They have been splitted from the main file to avoid circular dependencies.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-24
 */
import type {NodeCore} from "@/electron/modules/NodeCore";

// > User interface info

/** Description of the node graphical output:
 *  - "out": generates graphical output
 *  - "in": the viewer
 *  - "none": is pure computation
 * @notExported
 */
type GraphicType = "none" | "in" | "out";

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
}

/** Description of one available node */
export interface OneNodeInfo {

	/** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

	/** True if the node accepts an input structure */
	in: boolean;

	/** True if the node send a structure down the pipeline */
	out: boolean;

	/** "out": generates graphical output, "in": the viewer, "none": is pure computation */
	graphic: "none" | "in" | "out";

	/** Prefix to automatically generate id by project editor */
	idPrefix: string;

	/** The name of the node ui component */
	ui: string;

	/** The class that will be instanced if the node is active */
	// eslint-disable-next-line @typescript-eslint/prefer-function-type
	handler: {new (id: string): NodeCore};
}

/** List of ui modules descriptions to the client */
export type ClientProjectInfo = Record<string, ClientProjectInfoItem>;

/** Project data to the project editor */
export interface ProjectInfo {

	/** Project content */
	graph: ClientProjectInfo;

	/** All available nodes info */
	allNodes: OneNodeInfo[];
}
