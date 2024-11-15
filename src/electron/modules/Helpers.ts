/**
 * Support routines for the readers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import type {BasisType, LengthsAnglesType, PositionType, Structure} from "@/types";

/** Convert degrees to radiants and viceversa */
const DEG2RAD = Math.PI/180;
const RAD2DEG = 180/Math.PI;

/**
 * Extract the basis vectors from basis lengths and angles
 *
 * @param a - Unit cell vector a
 * @param b - Unit cell vector b
 * @param c - Unit cell vector c
 * @param alpha - Unit cell angles (degrees)
 * @param beta - Unit cell angles (degrees)
 * @param gamma - Unit cell angles (degrees)
 * @returns The basis vectors
 */
export const extractBasis = (a: number, b: number, c: number,
							 alpha: number, beta: number, gamma: number): BasisType => {

	if(a <= 0 || b <= 0 || c <= 0) {
		return [1, 0, 0, 0, 1, 0, 0, 0, 1];
	}

	if(gamma <= 0) gamma = -gamma;

	if(alpha === 90 && beta === 90 && gamma === 90) {
		return [a, 0, 0, 0, b, 0, 0, 0, c];
	}

	const alphaRad = alpha*DEG2RAD;
	const betaRad  = beta*DEG2RAD;
	const gammaRad = gamma*DEG2RAD;
	const cosAlpha = Math.cos(alphaRad);
	const cosBeta  = Math.cos(betaRad);
	const cosGamma = Math.cos(gammaRad);
	const sinGamma = Math.sin(gammaRad);

	// Compute and return the basis vectors
	return [
		a,
		0,
		0,

		b * cosGamma,
		b * sinGamma,
		0,

		c * cosBeta,
		c * (cosAlpha - cosBeta*cosGamma) / sinGamma,
		c * Math.sqrt(1 - cosAlpha*cosAlpha - cosBeta*cosBeta -
					  cosGamma*cosGamma + 2*(cosAlpha*cosBeta*cosGamma))/sinGamma
	];
};

/**
 * Convert fractional coordinates into corresponding cartesian ones
 *
 * @param basis - The structure basis vectors
 * @param fx - The fractional x coordinate
 * @param fy - The fractional y coordinate
 * @param fz - The fractional z coordinate
 * @param origin - Origin of the unit cell (if missing means [0, 0, 0])
 * @returns The corresponding cartesian coordinates
 */
export const fractionalToCartesianCoordinates = (basis: BasisType,
												 fx: number, fy: number, fz: number,
												 origin?: PositionType): PositionType => {

	if(fx < 0) fx += 1;
	else if(fx > 1) fx -= 1;
	if(fy < 0) fy += 1;
	else if(fy > 1) fy -= 1;
	if(fz < 0) fz += 1;
	else if(fz > 1) fz -= 1;

	if(origin) {
		return [
			fx*basis[0] + fy*basis[3] + fz*basis[6] + origin[0],
			fx*basis[1] + fy*basis[4] + fz*basis[7] + origin[1],
			fx*basis[2] + fy*basis[5] + fz*basis[8] + origin[2],
		];
	}

	return [
		fx*basis[0] + fy*basis[3] + fz*basis[6],
		fx*basis[1] + fy*basis[4] + fz*basis[7],
		fx*basis[2] + fy*basis[5] + fz*basis[8],
	];
};

/**
 * Compute the angle between two vectors.
 *
 * @param v0 - First vector x
 * @param v1 - First vector y
 * @param v2 - First vector z
 * @param w0 - Second vector x
 * @param w1 - Second vector y
 * @param w2 - Second vector z
 * @returns Angle in degrees between the two vectors
 */
const vectorAngle = (v0: number, v1: number, v2: number, w0: number, w1: number, w2: number): number => {

	const dotProduct = v0*w0 + v1*w1 + v2*w2;
	const lv2 = v0*v0 + v1*v1 + v2*v2;
	const lw2 = w0*w0 + w1*w1 + w2*w2;

	return Math.acos(dotProduct/Math.sqrt(lv2*lw2))*RAD2DEG;
};

/**
 * Transform the basis vectors into (a, b, c, alpha, beta, gamma)
 *
 * @param basis - Basis vectors
 * @returns Tuple with in order: a, b, c, alpha, beta, gamma
 */
export const basisToLengthAngles = (basis: BasisType): LengthsAnglesType => [

	// Unit cell sides
	Math.hypot(basis[0], basis[1], basis[2]),
	Math.hypot(basis[3], basis[4], basis[5]),
	Math.hypot(basis[6], basis[7], basis[8]),

	// Angles
	vectorAngle(basis[6], basis[7], basis[8], basis[3], basis[4], basis[5]),
	vectorAngle(basis[0], basis[1], basis[2], basis[6], basis[7], basis[8]),
	vectorAngle(basis[0], basis[1], basis[2], basis[3], basis[4], basis[5]),
];


// > Compute the atoms' fractional coordinates
/**
 * Compute the structure atoms' fractional coordinates
 *
 * @param structure - The structure from which the atoms coordinates should be converted to fractional
 * @returns The array of fractional coordinates
 * @throws Error
 * The basis matrix is not invertible
 */
export const cartesianToFractionalCoordinates = (structure: Structure): number[] => {

	// Get the structure
	const {crystal, atoms} = structure;
	const {basis: b, origin} = crystal;

	// Compute the determinant of the matrix
	const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
				b[1] * (b[3] * b[8] - b[5] * b[6]) +
				b[2] * (b[3] * b[7] - b[4] * b[6]);

	// Check if the determinant is zero, which means the matrix is not invertible
	if(det === 0) throw Error("Basis matrix is not invertible");

	// Compute the inverse basis matrix
	const invDet = 1 / det;
	const inverse = [
		(b[4] * b[8] - b[5] * b[7]) * invDet,
		(b[2] * b[7] - b[1] * b[8]) * invDet,
		(b[1] * b[5] - b[2] * b[4]) * invDet,
		(b[5] * b[6] - b[3] * b[8]) * invDet,
		(b[0] * b[8] - b[2] * b[6]) * invDet,
		(b[2] * b[3] - b[0] * b[5]) * invDet,
		(b[3] * b[7] - b[4] * b[6]) * invDet,
		(b[1] * b[6] - b[0] * b[7]) * invDet,
		(b[0] * b[4] - b[1] * b[3]) * invDet
	];

	// For each atom compute the fractional coordinates
	const fractionalCoords: number[] = [];
	for(const atom of atoms) {

		const {position} = atom;
		const cx = position[0] - origin[0];
		const cy = position[1] - origin[1];
		const cz = position[2] - origin[2];

		fractionalCoords.push(cx*inverse[0] + cy*inverse[3] + cz*inverse[6],
							  cx*inverse[1] + cy*inverse[4] + cz*inverse[7],
							  cx*inverse[2] + cy*inverse[5] + cz*inverse[8]);
	}

	return fractionalCoords;
};

/**
 * Format a floating point value
 *
 * @param value - Value to be formatted
 * @returns Value as string
 */
export const format = (value: number): string => value.toFixed(6).padStart(10, " ");

/**
 * Check if the basis matrix is empty
 *
 * @param basis - The basis matrix to test
 * @returns True if the basis has no vector defined
 */
export const hasNoUnitCell = (basis: BasisType): boolean => basis.every((value) => value === 0);

/**
 * Get the volume value range
 *
 * @param structure - The structure with volumetric data
 * @param dataset - Which volumetric dataset to analyze
 * @returns If there is volumetric data returns [min volume value, max volume value], otherwise [-10, 10]
 */
export const getValueLimits = (structure: Structure, dataset: number): [number, number] => {

	// Check if there is the volumetric data to analyze
	if(!structure?.volume) return [-10, 10];
	const {values} = structure.volume[dataset];
	if(values.length === 0) return [-10, 10];

	// Get the value range
	let minValue = Number.POSITIVE_INFINITY;
	let maxValue = Number.NEGATIVE_INFINITY;
	for(const value of values) {
		if(value < minValue) minValue = value;
		if(value > maxValue) maxValue = value;
	}

	return [minValue, maxValue];
};
