/**
 * Some constants shared between main and client processes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-02
 */

/** Multiplicative coefficients for basis to get atoms adjacent to the unit cell */
export const displacementCoefficients = [

	[1,  0, 0], // Z = 0
	[1,  1, 0],
	[1, -1, 0],

	[-1,  0, 0],
	[-1,  1, 0],
	[-1, -1, 0],

	[0,  1, 0], // [0, 0, 0] is obviously missing
	[0, -1, 0],

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

/** Bond type values */
export const BondType = {
    normal: 	0,
    hydrogen:   1,
    invalid:   99
} as const;

/** Add type values 1: atom in unit cell; 2: atom outside unit cell */
export const AddType = {
	removed: -1,
	inside:   1,
	outside:  2,
	added:   22
} as const;
export type AddKind = (typeof AddType)[keyof typeof AddType];


// Triangles. Top and bottom facies are not needed
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
