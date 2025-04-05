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

    /** Chain indicator for protein structure (or a generic group indicator). Empty string if none */
    chain: string;

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
    step: number;

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
export type CtrlParams = Record<string, string | number | boolean | ArrayBuffer | number[] | string[]>;

/** Viewer 3D state */
export interface Viewer3DState {
    /** Status related to the camera */
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
    /** Status related to the scene */
    scene: {
        /** Scene background color formatted as #RRGGBB */
        background: string;
    };
    /** Status related to the lighting */
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
    /** Status related to the scene helpers */
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
        /** Name of the channel (used to access it) */
        name: string;
        /** The channel send a request and wait for a synchronous answer */
        type: "invoke";
        /** Callback to be invoked when receiving a request */
        callback: ((params: CtrlParams) => CtrlParams);
    } |
    {
        /** Name of the channel (used to access it) */
        name: string;
        /** The channel send a request and wait for an asynchronous answer */
        type: "invokeAsync";
        /** Callback to be invoked when receiving a request */
        callback: ((params: CtrlParams) => Promise<CtrlParams>);
    } |
    {
        /** Name of the channel (used to access it) */
        name: string;
        /** The channel send a request but do not want an answer */
        type: "send";
        /** Callback to be invoked when receiving a request */
        callback: (params: CtrlParams) => void;
    };

/** Options object for the readers */
export interface ReaderOptions {

	/** Optional list of atoms types from the user */
	atomsTypes?: string[];

	/** Use Bohr measurement units instead of Angstroms */
	useBohr?: boolean;

    /** For read PDB to read also hydrogen atoms */
    readHydrogen?: boolean;
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

    /** Value to compute the bond strength */
    bondStrength: number;
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
    /** Resizes the chart canvas when its container does */
    responsive: boolean;
    /** Maintain aspect ratio of the chart when resizing */
    maintainAspectRatio: boolean;
    /** Inline data related to ChartJS plugins */
    plugins?: {
        /** Chart title */
        title?: {
            /** Title text */
            text: string;
            /** Show the title */
            display: boolean;
            /** Fonts for the title */
            font: Record<string, number | string>;
            /** Optional text padding */
            padding?: number;
        };
        /** Chart legend */
        legend?: {
            /** If the legend should be visible */
            display: boolean;
        };
        /** Label on data points */
        datalabels?: {
            /** Color of the label */
            color?: string;
            /** Routine to format (or create) the data labels */
            formatter?: (value: unknown, context: Context) => string;
            /** Align the label */
            align?: Align;
            /** Where to anchor the label */
            anchor?: Anchor;
        };
    };
    /** Charts elements */
    elements?: {
        /** Data for the line element */
        line: {
            /** Width of the line */
            borderWidth: number;
        };
    };
    /** Global layout of the chart */
    layout?: {
        /** Global padding around the chart */
        padding: number;
    };
    /** Grid scales */
    scales?: {
        /** X axis scale */
        x: {
            /** Title of the axis */
            title: {
                /** Title color */
                color: string;
                /** If the title should be visible */
                display: boolean;
                /** Text of the axis title */
                text: string;
                /** Font for the axis title */
                font?: Record<string, number | string>;
            };
            /** Data for the chart grid lines perpendicular to the X axis */
            grid: Record<string, string>;
        };
        /** Y axis scale */
        y: {
            /** Title of the axis */
            title: {
                /** Title color */
                color: string;
                /** If the title should be visible */
                display: boolean;
                /** Text of the axis title */
                text: string;
                /** Font for the axis title */
                font?: Record<string, number | string>;
            };
            /** Data for the chart grid lines perpendicular to the Y axis */
            grid: Record<string, string>;
        };
    };
}

/** Chart points coordinates */
export interface ChartCoordinate {
    /** X coordinate of the point */
    x: number;
    /** Y coordinate of the point */
    y: number;
}

/** Data to be charted */
export interface ChartData {
    /** Labels on the X axis */
    labels?: string[];
    /** One set of data to plot */
    datasets: {
        /** Label for the dataset (needed to link to the legend) */
        label: string;
        /** If the curve should be filled */
        fill?: boolean;
        /** Color for the curve */
        backgroundColor: string;
        /** Border color for the points */
        borderColor: string;
        /** Radius of the points */
        pointRadius?: number;
        /** Value of the dataset */
        data: number[] | ChartCoordinate[];
        /** If the line should be shown, not only the points */
        showLine?: boolean;
        /** Data for the optional labels on the points */
        datalabels?: {
            /** If the label should be show */
            display?: boolean;
            /** Label color */
            color?: string;
            /** Label alignment */
            align?: Align;
            /** Where the label should be anchored */
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

    /** The computed fingerprint */
    fingerprint: Float64Array;

    /** The set of weights for a multisection fingerprint */
    weights: Float64Array;
}

/** Data for the fingerprint scatterplot window */
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

    /** If present, the updated list of selected points */
    selectedPoints?: number[];
}

/** Data for the energy landscape window */
export interface EnergyLandscapeData {

    /** Fingerprints projected in 2D. The coordinates are normalized between 0 and 1 */
    points: number[][];

    /** Corresponding energies (unnormalized) */
    energies: number[];
}

/** Data for the fingerprint chart window */
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
