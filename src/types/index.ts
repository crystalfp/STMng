/**
 * Main types definitions.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-07
 */
import type {Context} from "chartjs-plugin-datalabels";

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

/** Extra per structure data */
export interface Extra {

    /** Step index that identifies the structure in a sequence (one based) */
    id: number;

    /** Structure energy or enthalpy */
    energy?: number;
}

/** The whole atomic structure */
export interface Structure {

    /** Crystallographic data */
    crystal:    Crystal;

    /** Atoms in the structure */
    atoms:      Atom[];

    /** Structure bonds */
    bonds:      Bond[];

    /** Volumetric data */
    volume:     Volume[];

    /** Per structure data */
    extra:      Extra;
}

/**
 * Alternative description of the unit cell as base vectors and angles
 */
export type LengthsAnglesType = [a: number, b: number, c: number,
                                 alpha: number, beta: number, gamma: number];

// > The project structure
/**
 * Project node description
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

/** The project graph */
export type ProjectGraph = Record<string, GraphNode>;

/** Type of the node state variables */
export type CtrlParams = Record<string, string | number | boolean | ArrayBuffer | number[]>;

/** Viewer 3D state */
export interface Viewer3DState {
    camera: {
        /** Type of the camera */
        type: "perspective" | "orthographic";
        /** Position of the camera */
        position: PositionType;
        /** Point where the camera points */
        lookAt: PositionType;
        /** Format of the screenshot */
        snapshotFormat: "png" | "jpeg";
        /** STL file format */
        stlFormat: "ascii" | "binary";
        /** Position of the camera */
        forcePosition: PositionType;
        /** Point where the camera points */
        forceLookAt: PositionType;
    };
    scene: {
        /** Scene background color formatted as #RRGGBB */
        background: string;
    };
    lights: {
        /** Ambient light color in #RRGGBB format */
        ambientColor: string;
        /** Ambient light intensity (0-1) */
        ambientIntensity: number;
        /** First directional light color in #RRGGBB format */
        directional1Color: string;
        /** First directional light intensity (0-1) */
        directional1Intensity: number;
        /** Second directional light color in #RRGGBB format */
        directional2Color: string;
        /** Second directional light intensity (0-1) */
        directional2Intensity: number;
        /** Third directional light color in #RRGGBB format */
        directional3Color: string;
        /** Third directional light intensity (0-1) */
        directional3Intensity: number;
        /** Vector of the first directional light */
        directional1Position: PositionType;
        /** Vector of the second directional light */
        directional2Position: PositionType;
        /** Vector of the third directional light */
        directional3Position: PositionType;
    };
    helpers: {
        /** Show cartesian axis centered in the origin */
        showAxis: boolean;
        /** Length of the cartesian axis */
        axisLength: number;
        /** Show grid on the XZ plane */
        showGridXZ: boolean;
        /** Show grid on the XY plane */
        showGridXY: boolean;
        /** Show grid on the YZ plane */
        showGridYZ: boolean;
        /** Squares on the side of the grid (an even number) */
        gridSize: number;
        /** Orientation gizmo visibility */
        showGizmo: boolean;
    };
}

/** The project structure on disk */
export interface Project {

    /** The graph structure as read from file (The key is the node id) */
    graph: ProjectGraph;

    /** The id of the selected node */
    currentId?: string;

    /** The state of the viewer */
    viewer?: Viewer3DState;

    /** The state of the other nodes (The key is the node id) */
    ui?: Record<string, CtrlParams>;
}

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
    /** Info on how to render the atoms */
    atoms: AtomRenderInfo[];
    /** List of bonds */
    bonds: Bond[];
    /** Unit cell data */
    cell: {
        /** Cell origin */
        origin: PositionType;
        /** Cell basis vectors */
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
    data: string;
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

// > Types for charts
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

/** Chart points coordinates */
export type ChartCoordinates = {x: number; y: number}[];

/** Data to be charted */
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

// > Fingerprinting
/** Parameters for fingerprinting */
export interface FingerprintingParameters {

    /** Fingerprinting method (index into the list of methods) */
	method: number;

    /** If the structures are nanoclusters */
	areNanoclusters: boolean;

    /** End radius for fingerprinting computation */
	cutoffDistance: number;

    /** Width of the histogram bins */
	binSize: number;

    /** Width of the smoothing Gaussian */
	peakWidth: number;
}

/** Result from computing fingerprint */
export interface FingerprintingResult {

    /** Number of sections in the fingerprint */
    countSections: number;

    /** Length of each section of the fingerprint */
    sectionLength: number;

    fingerprint: Float64Array;

    weights: Float64Array;
}

export interface ScatterplotData {

    /** Structures index (the original one, not filtered by energy) */
    id: number[];

    /** Fingerprints projected in 2D. The coordinates are normalized between 0 and 1 */
    points: number[][];

    /** For each point, the associated value that could be:
     * - the group to which the fingerprint pertains
     * - the energy of the corresponding structure
     * - the silhouette coefficients that measure the clustering quality for each point
     */
    values: number[];

    /** Total number of groups */
    countGroups: number;

    /** If the data has energies */
    hasEnergies: boolean;

    /** Comparison between original and projected distances.
     * The distances are normalized between 0 and 1.
     * The first index is the original distance, the second is the projected distance.
     */
    fidelity: number[][];
}

export interface EnergyLandscapeData {

    /** Fingerprints projected in 2D. The coordinates are normalized between 0 and 1 */
    points: number[][];

    /** Corresponding energies (unnormalized) */
    energies: number[];
}

export interface FingerprintsChartData {

    /** How many fingerprints have been computed */
    countFingerprints?: number;

    /** If the structures have energies */
    haveEnergies: boolean;

    /** If the structures have distances */
    haveDistances: boolean;

    /** List of structure id for the set of fingerprints */
    structureIds?: number[];

    /** Requested fingerprint */
    fingerprint?: [x: number, y: number][];

    /** The energy-distance chart */
    energyDistance?: [x: number, y: number][];

    /** Energies histogram chart */
    energyHistogram?: [x: number, y: number][];

    /** Distances histogram chart */
    distanceHistogram?: [x: number, y: number][];

    /** Order parameter */
    order?: [id: number, order: number][];

    /** Distances from a given fingerprint chart */
    distances?: [id: number, y: number][];
}

/**
 * Type of chart to display in the fingerprints chart window
 *
 * - "fp" one fingerprint
 * - "ed" energy from minimum vs. distance
 * - "eh" energy histogram
 * - "dh" distances histogram
 * - "op" order parameter
 * - "di" distances from a given fingerprint
 */
export type FingerprintsChartKind = "fp" | "ed" | "eh" | "dh" | "op" | "di";
