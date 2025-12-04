/**
 * Types used by the aflow prototype matcher routines.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
/**
 * Prototype tags
 */
export interface PrototypeTags {
	/** Pearson symbol */
	pearson: string;
	/** AFLOW identifier (UID) */
	aflow: string;
	/** A detailed crystal structure classification by analogy to another known structure */
	strukturbericht: string;
	/** Prototype mineral/component name */
	mineral: string;
}

/** One found prototype */
export interface Prototype {
	/** Prototype tags */
	tags: PrototypeTags;
}

/** Complete Pymatgen lattice */
export interface Lattice {
	/** Unit cell vectors */
	matrix: number[][];
	// pbc: [boolean, boolean, boolean];
	/** Unit cell vector a length */
	a: number;
	/** Unit cell vector b length */
	b: number;
	/** Unit cell vector c length */
	c: number;
	/** Alpha angle */
	alpha: number;
	/** Beta angle */
	beta: number;
	/** Gamma angle */
	gamma: number;
	/** Cell volume */
	volume: number;
}

/** Atom position */
export interface Site {
	/** Atoms sharing the position */
	species: {
		/** Atom type */
		element: string;
		/** Occupancy (always 1) */
		occu: number;
	}[];
	/** Fractional coordinates */
	abc: number[];
	/** Cartesian coordinates */
	xyz: number[];
	/** Atom label */
	label: string;
}

/** Pymatgen structure */
export interface SNL {
	/** Structure lattice */
	lattice: Lattice;
	/** Atom positions */
	sites: Site[];
}

/** AFLOW prepared prototypes list entry */
export interface PrototypeEntry {
	/** The prototype structure */
	structure: {
		/** Not used */
		"@module": string;
		/** Not used */
		"@class": string;
		/** Charge */
		charge: number;
		/** Structure lattice */
		lattice: Lattice;
		/** Not used, always an empty object */
		properties: unknown;
		/** Atoms positions */
		sites: Site[];
	};
	/** The corresponding tags */
	tags: PrototypeTags;
}
