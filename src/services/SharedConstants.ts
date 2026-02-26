/**
 * Some constants shared between main and client processes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-02
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
 * Multiplicative coefficients for basis
 * to get atoms adjacent to the unit cell
 */
export const displacementCoefficients = [

	// Z = 0 ([0, 0, 0] is obviously not added)
	[0,  1, 0],
	[0, -1, 0],

	[-1,  0, 0],
	[-1,  1, 0],
	[-1, -1, 0],

	[1,  0, 0],
	[1,  1, 0],
	[1, -1, 0],

	// Z = 1
	[0,  0, 1],
	[0,  1, 1],
	[0, -1, 1],

	[-1,  0, 1],
	[-1,  1, 1],
	[-1, -1, 1],

	[1,  0, 1],
	[1,  1, 1],
	[1, -1, 1],

	// Z = -1
	[0,  0, -1],
	[0,  1, -1],
	[0, -1, -1],

	[-1,  0, -1],
	[-1,  1, -1],
	[-1, -1, -1],

	[1,  0, -1],
	[1,  1, -1],
	[1, -1, -1],
] as const;

/** Bond type */
export const BondType = {
	/** Normal bond */
    normal: 	0,
	/** Hydrogen bond */
    hydrogen:   1,
	/** Bond to be removed (used only inside ComputeBonds) */
    invalid:   99
} as const;

/** Atoms add type */
export const AddType = {
	/** Atom not added (used only inside ComputeBonds) */
	removed: -1,
	/** Atom in unit cell */
	inside:   1,
	/** Atom outside unit cell */
	outside:  2,
	/** Atom added to the neighbors of the unit cell ones */
	added:   22,
	/** Atom added to the neighbors of already added ones */
	added2:  33,
} as const;

/** Type of the variables containing AddType values */
export type AddKind = (typeof AddType)[keyof typeof AddType];

/**
 * Convert bohr units into angstrom.
 * Value from https://physics.nist.gov/cgi-bin/cuu/Value?bohrrada0
 */
export const BOHR_TO_ANGSTROM = 0.529177210544;

/**
 * Pairs of unit cell vertices indices multiplied by 3
 * Vertices order is: (below) 0-1-2-3 (above) 4-5-6-7
 */
export const order3 = [
	0, 3,
	3, 6,
	6, 9,
	9, 0,
	12, 15,
	15, 18,
	18, 21,
	21, 12,
	0, 12,
	3, 15,
	6, 18,
	9, 21
];
