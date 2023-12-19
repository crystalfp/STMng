import * as THREE from "three";

export interface Viewer3DConfiguration {

    camera: {
        perspective: boolean;
        orthoSide: number;
    };
    scene: {
        background: string;
        showGrid: boolean;
        showAxis: boolean;
    };
    lights: {
        ambientColor: string;
        ambientIntensity: number;
        directional1Color: string;
        directional1Intensity: number;
        directional1Position: [number, number, number];
        directional2Color: string;
        directional2Intensity: number;
        directional2Position: [number, number, number];
        directional3Color: string;
        directional3Intensity: number;
        directional3Position: [number, number, number];
    };
    materials: {
        quality: number;
        roughness: number;
        metalness: number;
    };
}


export type Object3D = {
    type: "sphere";
    radius: number;
    position: [number, number, number];
    color: THREE.ColorRepresentation;
} |
{
    type: "cube";
    sides: [number, number, number];
    position: [number, number, number];
    color: THREE.ColorRepresentation;
} |
{
    type: "cylinder";
    radius: number;
    start: [number, number, number];
    end: [number, number, number];
    colorStart: THREE.ColorRepresentation;
    colorEnd: THREE.ColorRepresentation;
};

export interface Atom2 {
    position: [number, number, number];
    Z: number;
}

type BondType2 = "normal" | "hydrogen";

export interface Bond2 {
    from: number;
    to: number;
    kind: BondType2;
}

export interface ProjectElement {
    id: string;
    label: string;
    ui: string;
    in: string;
}

export interface Project {
    graph: ProjectElement[];
}

export interface ChartData {
    x: number[];
    y: number[];
    type: string;
}

// > Type of a collection of atomic structures
/** One atom in the structure or step in the structure */
export interface Atom {
    /** Atomic number */
    atomZ:  number;
    /** Coordinates absolute of the atom (in Å) */
    x:      number;
    y:      number;
    z:      number;
}

/** Type of bond: "h" Hydrogen bond; "n" Single bond; "x" No bond */
export type BondType = "n" | "h" | "x";

/** Definition of a bond */
export interface Bond {
    /** Index in the structure of the atom from which the bond starts */
    from: number;
    /** Index in the structure of the atom from which the bond starts */
    to:   number;
    /** Kind of bond */
    type: BondType;
}

export type Look = Record<number, AtomAppearance>;
export interface Structure {
    atoms: Atom[];
    bonds: Bond[];
    look:  Look;
}
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

export interface ReaderStructure {
    filename: string;
    structures: Structure[];
    error?: string;
}
