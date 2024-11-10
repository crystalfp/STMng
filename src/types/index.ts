/**
 * Types definitions shared between client and main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-07
 */
import type {Context} from "chartjs-plugin-datalabels";
/**
 * Label alignment respect to the point
 * @notExported
 */
type Align = "bottom" | "center" | "end" | "left" | "right" | "start" | "top" | number;
/**
 * Where to anchor the label on the point
 * @notExported
 */
type Anchor = "center" | "end" | "start";

// > Type of a collection of atomic structures
// >> Base types
/** An [x, y, z] position */
export type PositionType = [x: number, y: number, z: number];

/** The unit cell basis vectors [a, b, c] where e.g, a = [ax, ay, az] */
export type BasisType = [
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number
];

/** One atom in the structure or in the structure of one step */
export interface Atom {

    /** Atomic number */
    atomZ: number;

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
    to: number;

    /** Type of bond: 0: Single bond; 1: Hydrogen bond; 99: No bond (used only by ComputeBonds) */
    type: 0 | 1 | 99;
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
/**
 * Project structure
 * @notExported
 */
interface GraphNode {

    /** The label that appears on the node selector */
	label: string;

    /** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	in?: string;
}

/** Type of the node state variables */
export type CtrlParams = Record<string, string | number | boolean | ArrayBuffer>;

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

    /** The graph structure as read from file (The key is the node id) */
    graph: Record<string, GraphNode>;

    /** The id of the selected node */
    currentId?: string;

    /** The state of the viewer */
    viewer?: ViewerState;

    /** The state of the other nodes (The key is the node id) */
    ui?: Record<string, CtrlParams>;
}

// > User interface info
/** User interface info */
export interface UiInfo {

    /** ID of the node */
    id: string;

	/** The name of the node ui component */
	ui: string;

	/** "out": generates graphical output, "in": the viewer, "none": is pure computation */
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

    /** The type of the node (valid values in electron/modules/ProjectManager.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	input: string[];

	/** The name of the node ui component */
	ui: string;

	/** "out": generates graphical output, "in": the viewer, "none": is pure computation */
	graphic: "none" | "in" | "out";

    /** Channels names to communicate with the node */
    channels: string[];
}

/** List of ui modules descriptions to the client */
export type ClientProjectInfo = Record<string, ClientProjectInfoItem>;

/** Definition of the channels */
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

/** Options object for the readers */
export interface ReaderOptions {

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

/** Data needed to render an atom */
export interface AtomRenderInfo {

    /** Atomic number */
    atomZ: number;

	/** Element symbol */
	symbol: string;

    /** Label of the atom */
    label: string;

    /** Position of the atom */
    position: PositionType;

	/** Atom color as an hex string (#RRGGBB) */
	color: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;
}

/** Data for structure rendering */
export interface StructureRenderInfo {
    atoms: AtomRenderInfo[];
    bonds: Bond[];
    cell: {
        origin: PositionType;
        basis: BasisType;
    };
}

/** Parameters for the window creation */
export interface WindowsParams {

    /** The router path for the created window (should also be in src/router/index.ts) */
    routerPath: string;

    /** Width of the window */
    width: number;

    /** Height of the window */
    height: number;

    /** Title of the window */
    title: string;

    /** Data to be passed to the window when it is ready */
    data?: string;
}

/** Interface exposed by all format writers */
export interface WriterImplementation {

	/**
	 * Write structure file
	 *
	 * @param filename - Output filename
	 * @param structures - List of structures to be written
	 * @returns Standard response object
	 */
	writeStructure: (filename: string, structures: Structure[]) => CtrlParams;
}

/** Selected atoms data for measure */
export interface SelectedAtom {

    /** Atom index in the structure */
    index: number;

    /** Label for the selected atom */
    label: string;

    /** Atomic symbol */
    symbol: string;

    /** Color to distinguish the selected atom */
    color: string;

    /** Position of the atom */
    position: PositionType;

    /** Covalent radius of the atom */
    radius: number;

    /** Fractional coordinates. If cannot be computed it is [-1, -1, -1] */
    fractional: PositionType;
}

/** Bond data when measuring bonds lengths */
export interface BondData {

    /** Index of the bonded atom */
    idx: number;

    /** Bonded atom position */
	atomPosition: PositionType;

    /** Bonded atom radius */
    radius: number;

    /** Bond length */
	distance: number;
}

/** Accept string for the file selector */
export interface FileFilter {

    /** Name of the filter */
	name: string;

    /** List of accepted extensions */
	extensions: string[];
}

/** Definition of the chart data and options */
export interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins?: {
        title?: {
            text: string;
            display: boolean;
            font: Record<string, number | string>;
            padding?: number;
        };
        legend?: {
            display: boolean;
        };
        datalabels?: {
            color?: string;
            formatter?: (value: unknown, context: Context) => string;
            align?: Align;
            anchor?: Anchor;
        };
    };
    elements?: {
        line: {
            borderWidth: number;
        };
    };
    layout?: {
        padding: number;
    };
    scales?: {
      x: {
        title: {
          color: string;
          display: boolean;
          text: string;
          font?: Record<string, number | string>;
        };
        grid: Record<string, string>;
      };
      y: {
        title: {
          color: string;
          display: boolean;
          text: string;
          font?: Record<string, number | string>;
        };
        grid: Record<string, string>;
      };
    };
}

export type ChartCoordinates = {x: number; y: number}[];

export interface ChartData {
    labels?: string[];
    datasets: {
        label: string;
        fill?: boolean;
        backgroundColor: string;
        borderColor: string;
        pointRadius?: number;
        data: number[] | ChartCoordinates;
        showLine?: boolean;
        datalabels?: {
            display?: boolean;
            color?: string;
            align?: Align;
            anchor?: Anchor;
        };
    }[];
}

/** Parameters to draw the chart passed to the component */
export interface ChartParams {

    /** Data to be charted */
    data: ChartData;

    /** Options to draw the chart */
    options: ChartOptions;

    /** Type of chart to be shown */
    type: string;
}
