/**
 * Types used by the aflow prototype matcher routines.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
export interface Prototype {
	snl: string; // Strukturbericht designation
	tags: Record<string, string>; // Additional tags or descriptors
}

export interface Lattice {
	matrix: number[][];
	a: number;
	b: number;
	c: number;
	alpha: number;
	beta: number;
	gamma: number;
	volume: number;
}

export interface Site {
	species: {
		element: string;
		occu: number;
	}[];
	abc: number[];
	xyz: number[];
	label: string;
}

export interface SNL {
	lattice: Lattice;
	sites: Site[];
}

export interface LibraryEntry {
	snl: SNL;
	about: Record<string, unknown>;
	tags: Record<string, string>;
}
