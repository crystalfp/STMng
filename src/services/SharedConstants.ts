/**
 * Some constants shared between main and client processes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-02
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

	[0,  0, 1], // Z = 1
	[0,  1, 1],
	[0, -1, 1],

	[-1,  0, 1],
	[-1,  1, 1],
	[-1, -1, 1],

	[1,  0, 1],
	[1,  1, 1],
	[1, -1, 1],

	[0,  0, -1], // Z = -1
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
} as const;

/** Type of the variables containing AddType values */
export type AddKind = (typeof AddType)[keyof typeof AddType];

/**
 * Triangles indices for a box. Top and bottom facies are not needed
 */
export const indices = [

    4, 5, 1,
    4, 1, 0,

    3, 2, 6,
    3, 6, 7,

    4, 0, 3,
    4, 3, 7,

    1, 5, 6,
    1, 6, 2,
];

/**
 * Convert bohr units into angstrom.
 * Value from https://physics.nist.gov/cgi-bin/cuu/Value?bohrrada0
 */
export const BOHR_TO_ANGSTROM = 0.529177210544;

/** Method to add atoms outside the unit cell */
export const EnlargeCell = {
	/** Atoms not added */
	none: 		"none",
	/** Atoms connected to atoms inside the unit cell */
	neighbors:	"neighbors",
	/** Atoms outside unit cell that form a polyhedra with internal ones */
	polyhedra:	"polyhedra",
	/** Atoms recursively connected to the unit cell ones */
	connected:	"connected",
} as const;

/** Type of the variables containing EnlargeCell values */
export type EnlargeCellKind = (typeof EnlargeCell)[keyof typeof EnlargeCell];
