
export interface NodeUI {
	id: string;
	ui: string;
	in?: string;
	label: string;
}

// TBD Definition of the chart data
export interface ChartOptions {
    responsive: boolean;
    maintainAspectRatio: boolean;
    plugins: {
      title: {
          text: string;
          display: boolean;
          font: Record<string, number | string>;
      };
    };
    scales: {
      x: {
        title: {
          color: string;
          display: boolean;
          text: string;
        };
        grid: Record<string, string>;
      };
      y: {
        title: {
          color: string;
          display: boolean;
          text: string;
        };
        grid: Record<string, string>;
      };
    };
}

export interface ChartData {
    labels: string[];
    datasets: {
            label: string;
            backgroundColor: string;
            data: number[];
            borderColor: string;
    }[];
}
export interface ChartParams {
    data: ChartData;
    options: ChartOptions;
    type: string;
}

// > Type of a collection of atomic structures
// >> Base types
export type PositionType = [number, number, number];

export type BasisType = [
    number, number, number,
    number, number, number,
    number, number, number
];

/** Type of bond: "h" Hydrogen bond; "n" Single bond; "x" No bond (used only by ComputeBonds) */
export type BondType = "h" | "n" | "x";

/** One atom in the structure or in one step in the structure */
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

    /** The unit cell basis vectors */
    basis: BasisType;

    /** Origin of the unit cell */
    origin: PositionType;

    /** Space group */
    spaceGroup: string;
}

/** Appearance of the various atoms types */
export interface AtomAppearance {

	/** Element symbol */
	symbol: string;

	/** Covalent radii (in Angstrom). 1.6 if unknown */
	rCov: number;

	/** Van der Waals radii (in Angstrom). 2.0 if unknown */
	rVdW: number;

	/** Atom color as hex string (#RRGGBB) */
	color: string;
}

/** Index is atomZ */
export type Look = Record<number, AtomAppearance>;

/** The whole atomic structure */
export interface Structure {
    crystal:    Crystal;
    atoms:      Atom[];
    bonds:      Bond[];
    look:       Look;
}

// > Interfaces with main process
export interface ReaderStructure {
    filename: string;
    structures: Structure[];
    error?: string;
}

export interface MainResponse {
    payload: string;
    error?: string;
}

// > The project structure
export interface GraphNode {

    /** The label that appears on the node selector */
	label: string;

    /** The type of the node (valid values in NodeInfo.ts) */
	type: string;

    /** Comma separated list of node ids from which the node takes inputs */
	in?: string;
}

import type {UiParams} from "@/services/Switchboard";

export interface Project {
    graph: Record<string, GraphNode>; // The key is the node id
    currentId?: string;
    viewer?: {
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
    };
    ui?: Record<string, UiParams>;
}
