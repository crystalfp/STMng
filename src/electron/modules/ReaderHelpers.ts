/**
 * Support routines for the readers.
 *
 * @packageDocumentation
 */

import {getAtomicRadiiAndColor} from "./AtomData";
import type {BasisType, PositionType, Atom, Look} from "../../types";

/**
 *
 * @param a - Unit cell vector a
 * @param b - Unit cell vector b
 * @param c - Unit cell vector c
 * @param alpha - Unit cell angles (degrees)
 * @param beta - Unit cell angles (degrees)
 * @param gamma - Unit cell angles (degrees)
 * @returns - The basis vectors
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

	const conv = Math.PI/180.0;
	const alphaRad = alpha*conv;
	const betaRad  = beta*conv;
	const gammaRad = gamma*conv;
	const cosAlpha = Math.cos(alphaRad);
	const cosBeta  = Math.cos(betaRad);
	const cosGamma = Math.cos(gammaRad);
	const sinGamma = Math.sin(gammaRad);

	// Compute the basis vectors
	const basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	basis[0] = a;
	// basis[1] = 0;
	// basis[2] = 0;

	basis[3] = b * cosGamma;
	basis[4] = b * sinGamma;
	// basis[5] = 0;

	basis[6] = c * cosBeta;
	basis[7] = c * (cosAlpha - cosBeta*cosGamma) / sinGamma;
	basis[8] = c * Math.sqrt(1. - cosAlpha*cosAlpha - cosBeta*cosBeta -
							 cosGamma*cosGamma + 2.*(cosAlpha*cosBeta*cosGamma))/sinGamma;

	return basis;
};

/**
 * Convert fractional coordinates into corresponding cartesian ones
 *
 * @param basis - The structure basis vectors
 * @param fx - The fractional x coordinate
 * @param fy - The fractional y coordinate
 * @param fz - The fractional z coordinate
 * @param origin - Origin of the unit cell (if missing means [0, 0, 0])
 * @returns - The corresponding cartesian coordinates
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
 * Compute the "look" part of the structure
 *
 * @param atoms - Atoms in the structure
 * @returns The "look" component of the structure
 */
export const getStructureAppearance = (atoms: Atom[]): Look => {

	// Find distinct atom species
	const distinctAtoms = new Set<number>();
	for(const atom of atoms) distinctAtoms.add(atom.atomZ);

	const out: Look = {};
	for(const atomZ of distinctAtoms) {

		out[atomZ] = getAtomicRadiiAndColor(atomZ);
	}

	return out;
};
