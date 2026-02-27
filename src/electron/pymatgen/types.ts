/**
 * Types used by the aflow prototype matcher routines.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 *
 * This code is ported from the Python Pymatgen library:
 *
 * Shyue Ping Ong, William Davidson Richards, Anubhav Jain, Geoffroy Hautier,
 * Michael Kocher, Shreyas Cholia, Dan Gunter, Vincent Chevrier, Kristin A.
 * Persson, Gerbrand Ceder. Python Materials Genomics (pymatgen): A Robust,
 * Open-Source Python Library for Materials Analysis. Computational Materials
 * Science, 2013, 68, 314–319. https://doi.org/10.1016/j.commatsci.2012.10.028
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
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
