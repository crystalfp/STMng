/**
 * Types definitions shared between client and main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-07
 */

// > Type of a collection of atomic structures
// >> Base types
/** An [x, y, z] position */
export type PositionType = [number, number, number];

/** The unit cell basis vectors [a, b, c] where e.g, a = [ax, ay, az] */
export type BasisType = [
    number, number, number,
    number, number, number,
    number, number, number
];

/** Type of bond: "h" Hydrogen bond; "n" Single bond; "x" No bond (used only by ComputeBonds) */
export type BondType = "h" | "n" | "x";

/** One atom in the structure or in the structure of one step */
export interface Atom {

    /** Atomic number */
    atomZ:  number;

    /** Label for the atom */
    label: string;

    /** Absolute coordinates of the atom (in Å) [x, y, z] */
    position: PositionType;
}

/** Definition of a bond */
export interface Bond {

    /** Index in the list of atoms where the bond starts */
    from: number;

    /** Index in the list of atoms where the bond ends */
    to:   number;

    /** Kind of bond */
    type: BondType;
}

/** Crystallographic data */
export interface Crystal {

    /** The unit cell basis vectors [a, b, c] */
    basis: BasisType;

    /** Origin of the unit cell */
    origin: PositionType;

    /** Space group */
    spaceGroup: string;
}

/** Volumetric data */
export interface Volume {

    /** Sides of the data cube [along x, along y, along z] */
    sides: PositionType;

    /** The list of values (x the quickest index) */
    values: number[];
}

/** The whole atomic structure */
export interface Structure {

    /** Crystallographic data */
    crystal:	Crystal;

    /** Atoms in the structure */
    atoms:      Atom[];

    /** Structure bonds */
    bonds:      Bond[];

    /** Volumetric data */
    volume:     Volume[];
}

// > The project structure
/** Project structure */
export interface GraphNode {

    /** The label that appears on the node selector */
	label: string;

    /** The type of the node (valid values in NodeInfo.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	in?: string;
}

/** The graph structure as read from file */
export type ProjectGraph = Record<string, GraphNode>; // The key is the node id

/** Type of the node state variables */
export type CtrlParams = Record<string, string | number | boolean>;

/** Viewer 3D state */
export interface ViewerState {
    camera: {
        type: "perspective" | "orthographic";
        position: PositionType;
        lookAt: PositionType;
        snapshotFormat: string;
    };
    scene: {
        background: string;
    };
    lights: {
        ambientColor: string;
        ambientIntensity: number;
        directional1Color: string;
        directional1Intensity: number;
        directional2Color: string;
        directional2Intensity: number;
        directional3Color: string;
        directional3Intensity: number;
        directional1Position: PositionType;
        directional2Position: PositionType;
        directional3Position: PositionType;
    };
    helpers: {
        showAxis: boolean;
        showGridXZ: boolean;
        showGridXY: boolean;
        showGridYZ: boolean;
        gridSize: number;
        axisLength: number;
    };
}

/** The project structure on disk */
export interface Project {
    graph: ProjectGraph;
    currentId?: string;
    viewer?: ViewerState;
    ui?: Record<string, CtrlParams>;
}

// > User interface info
/** User interface info */
export interface UiInfo {

    /** ID of the node */
    id: string;

	/** The name of the node ui component */
	ui: string;

	/** "out" generates graphical output, "in" the viewer, "none" is pure computation */
	graphic: "none" | "in" | "out";

    /** Channels names to communicate with the node */
    channels: string[];
}

// > Project information to the client
/** One UI module description */
export interface ClientProjectInfoItem {

    /** ID of the node */
    id: string;

    /** The label that appears on the node selector */
	label: string;

    /** The type of the node (valid values in NodeInfo.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	input: string[];

	/** The name of the node ui component */
	ui: string;

	/** "out" generates graphical output, "in" the viewer, "none" is pure computation */
	graphic: "none" | "in" | "out";

    /** Channels names to communicate with the node */
    channels: string[];
}

/** List of ui modules descriptions to the client */
export type ClientProjectInfo = Record<string, ClientProjectInfoItem>;

export type ChannelDefinition =
    {
        name: string;
        type: "invoke";
        callback: ((params: CtrlParams) => CtrlParams);
    } |
    {
        name: string;
        type: "invokeAsync";
        callback: ((params: CtrlParams) => Promise<CtrlParams>);
    } |
    {
        name: string;
        type: "send";
        callback: (params: CtrlParams) => void;
    };

/** Appearance of the various atoms types */
export interface AtomAppearance {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Atom color as an hex string (#RRGGBB) */
	color: string;

    /** Maximum number of bonds for the element type */
    maxBonds: number;
}

/** Options object for the readers */
interface ReaderOptions {
	/** Optional list of atoms types from the user */
	atomsTypes?: string[];
	/** Use Bohr measurement units instead of Angstroms */
	useBohr?: boolean;
}

/** Interface exposed by all format readers */
export interface ReaderImplementation {
	/**
	 * Read structure file
	 *
	 * @param filename - Structure file to be read
	 * @param options - Options for the reader
	 * @returns - List of structures read
	 */
	readStructure: (filename: string, options?: ReaderOptions) => Promise<Structure[]>;
}
