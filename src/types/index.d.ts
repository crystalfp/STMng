
export interface NodeUI {
	id: string;
	ui: string;
	in: string;
	label: string;
}

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

/** One atom in the structure or step in the structure */
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
    basis: BasisType;
    origin: PositionType;
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

export interface Structure {
    crystal:    Crystal;
    atoms:      Atom[];
    bonds:      Bond[];
    look:       Look;
}


export interface ReaderStructure {
    filename: string;
    format: string;
    structures: Structure[];
    error?: string;
}
