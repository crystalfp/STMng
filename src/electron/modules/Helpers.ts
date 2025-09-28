/**
 * Support routines for the readers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {getAtomicSymbol} from "./AtomData";
import type {BasisType, Bond, LengthsAnglesType, PositionType, Structure} from "@/types";

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

	// if(fx < 0) fx += 1;
	// else if(fx > 1) fx -= 1;
	// if(fy < 0) fy += 1;
	// else if(fy > 1) fy -= 1;
	// if(fz < 0) fz += 1;
	// else if(fz > 1) fz -= 1;

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
export const vectorAngle = (v0: number, v1: number, v2: number,
							w0: number, w1: number, w2: number): number => {

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

/**
 * Invert the basis matrix
 *
 * @param basis - Basis matrix
 * @returns Inverse of the basis matrix
 * @throws Error.
 * The basis matrix is not invertible
 */
export const invertBasis = (basis: BasisType | Float64Array): BasisType => {

	// Compute the determinant of the basis matrix
	const det = basis[0] * (basis[4] * basis[8] - basis[5] * basis[7]) -
				basis[1] * (basis[3] * basis[8] - basis[5] * basis[6]) +
				basis[2] * (basis[3] * basis[7] - basis[4] * basis[6]);

	// Check if the determinant is zero, which means the matrix is not invertible
	if(det === 0) throw Error("Basis matrix is not invertible");

	// Compute the inverse basis matrix
	const invDet = 1 / det;
	return [
		(basis[4] * basis[8] - basis[5] * basis[7]) * invDet,
		(basis[2] * basis[7] - basis[1] * basis[8]) * invDet,
		(basis[1] * basis[5] - basis[2] * basis[4]) * invDet,
		(basis[5] * basis[6] - basis[3] * basis[8]) * invDet,
		(basis[0] * basis[8] - basis[2] * basis[6]) * invDet,
		(basis[2] * basis[3] - basis[0] * basis[5]) * invDet,
		(basis[3] * basis[7] - basis[4] * basis[6]) * invDet,
		(basis[1] * basis[6] - basis[0] * basis[7]) * invDet,
		(basis[0] * basis[4] - basis[1] * basis[3]) * invDet
	];
};

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
	const {basis, origin} = crystal;

	// Compute inverse matrix
	const inverse = invertBasis(basis);

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

/** Output from reducing to fractional coordinates */
interface ReducedToFractional {

	/** Atoms without duplicates */
	atoms: {
		/** Atom index in the input structure */
		index: number;
		/** Cartesian coordinates */
		cart: PositionType;
		/** Fractional coordinates */
		frac: PositionType;
		/** Atom symbol */
		symbol: string;
		/** Atomic number */
		atomZ: number;
		/** Atom label */
		label: string;
		/** Chain label */
		chain: string;
	}[];

	/** List of atom species */
	atomSymbols: string[];

	/** Cound of atoms of each specie */
	atomCount: number[];

	/** List of atomic numbers */
	atomZ: number[];
}

/**
 * Compute list of fractional coordinates removing duplicated atoms
 * on the cell boundaries.
 * If there is no unit cell, nothing is removed
 *
 * @param structure - Structure from which the fractional coordinates
 * 					  should be computed
 * @returns List of non duplicated atoms
 */
export const reducingToFractionalCoordinates = (structure: Structure): ReducedToFractional => {

	const out: ReducedToFractional = {
		atoms: [],
		atomSymbols: [],
		atomCount: [],
		atomZ: []
	};

	// Get the structure
	const {crystal, atoms} = structure;
	const {basis, origin} = crystal;

	// Compute inverse matrix or leave it if not present
	const noUnitCell = hasNoUnitCell(basis);
	const inverse = noUnitCell ? basis : invertBasis(basis);

	// For each atom compute the initial fractional coordinates
	let index = 0;
	for(const atom of atoms) {

		const {position, atomZ, label, chain} = atom;

		const cx = position[0] - origin[0];
		const cy = position[1] - origin[1];
		const cz = position[2] - origin[2];

		out.atoms.push({
			index,
			cart: position,
			frac: noUnitCell ? [0, 0, 0] :
					[cx*inverse[0] + cy*inverse[3] + cz*inverse[6],
				     cx*inverse[1] + cy*inverse[4] + cz*inverse[7],
				     cx*inverse[2] + cy*inverse[5] + cz*inverse[8]],
			symbol: getAtomicSymbol(atomZ),
			atomZ,
			label,
			chain
		});
		++index;
	}

	// Sort the atoms on symbol
	out.atoms.sort((a, b) => a.symbol.localeCompare(b.symbol));

	// Count the input atoms per specie
	let previous = "";
	let idx = -1;
	for(const atom of out.atoms) {
		if(atom.symbol === previous) {
			++out.atomCount[idx];
		}
		else {
			out.atomSymbols.push(atom.symbol);
			out.atomZ.push(atom.atomZ);
			out.atomCount.push(1);
			++idx;
			previous = atom.symbol;
		}
	}

	// No unit cell so no reduction
	if(noUnitCell) return out;

	// Remove duplicates per specie
	let start = 0;
	const TOL = 1e-4;
	const countNew = [...out.atomCount];
	idx = 0;
	for(const count of out.atomCount) {
		if(count > 1) {
			const duplicated = Array<boolean>(count).fill(false);
			let hasDuplicates = false;
			for(let i=0; i<count-1; ++i) {
				if(duplicated[i]) continue;

				for(let j=i+1; j < count; ++j) {
					if(duplicated[j]) continue;

					const fi = out.atoms[i+start].frac;
					const fj = out.atoms[j+start].frac;

					const fdx = Math.abs(fi[0] - fj[0]);
					if(fdx < TOL || (fdx < 1 + TOL && fdx > 1 - TOL)) {
						const fdy = Math.abs(fi[1] - fj[1]);
						if(fdy < TOL || (fdy < 1 + TOL && fdy > 1 - TOL)) {
							const fdz = Math.abs(fi[2] - fj[2]);
							if(fdz < TOL || (fdz < 1 + TOL && fdz > 1 - TOL)) {
								duplicated[j] = true;
								hasDuplicates = true;
							}
						}
					}
				}
			}
			if(hasDuplicates) {
				for(let i=count-1; i>=0; --i) {
					if(duplicated[i]) {
						out.atoms.splice(i+start, 1);
						--countNew[idx];
					}
				}
			}
		}

		// Next specie
		start += countNew[idx];
		++idx;
	}

	// Update atoms counts
	out.atomCount = countNew;

	return out;
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
 * Check if there is a basis matrix
 *
 * @param basis - The basis matrix to test
 * @returns True if the basis has vectors defined
 */
export const hasUnitCell = (basis: BasisType): boolean => basis.some((value) => value !== 0);

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

/**
 * Check bond type normal
 *
 * @param bond - Bond to check
 * @returns True if it is a normal bond
 */
export const isNormalBond = (bond: Bond): boolean => bond.type === 0;

/**
 * Check bond type hydrogen
 *
 * @param bond - Bond to check
 * @returns True if it is a hydrogen bond
 */
export const isHydrogenBond = (bond: Bond): boolean => bond.type === 1;
