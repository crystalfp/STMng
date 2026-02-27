/**
 * Routines translated from Pymatgen coord.py file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-20
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
import {inv, multiply} from "mathjs";
import {determinant, pbc} from "./Utility";
import type {Lattice} from "./types";
import {getLLLmatrices} from "./Lattice";

/**
 * Get the list of points on the original lattice contained in the
 * supercell in fractional coordinates (with the supercell basis).
 * e.g. [[2,0,0],[0,1,0],[0,0,1]] returns [[0,0,0],[0.5,0,0]].
 *
 * @param supercellMatrix - 3x3 matrix describing the supercell
 * @returns Array of the fractional coordinates
 */
export const latticePointsInSupercell = (supercellMatrix: number[][]): number[][] => {

	// Define the 8 diagonal points
	const diagonals: number[][] = [
		[0, 0, 0],
		[0, 0, 1],
		[0, 1, 0],
		[0, 1, 1],
		[1, 0, 0],
		[1, 0, 1],
		[1, 1, 0],
		[1, 1, 1],
	];

	// Compute diagonal points transformed by supercell matrix
	const dPoints = multiply(diagonals, supercellMatrix);

	// Find mins and maxes along each axis
	const mins = [
		Math.min(...dPoints.map((p) => p[0])),
		Math.min(...dPoints.map((p) => p[1])),
		Math.min(...dPoints.map((p) => p[2])),
	];

	const maxes = [
		Math.max(...dPoints.map((p) => p[0])) + 1,
		Math.max(...dPoints.map((p) => p[1])) + 1,
		Math.max(...dPoints.map((p) => p[2])) + 1,
	];

	// Generate ranges for each axis
	const ar: number[][] = [];
	for(let i = mins[0]; i < maxes[0]; i++) {
		ar.push([i, 0, 0]);
	}

	const br: number[][] = [];
	for(let i = mins[1]; i < maxes[1]; i++) {
		br.push([0, i, 0]);
	}

	const cr: number[][] = [];
	for(let i = mins[2]; i < maxes[2]; i++) {
		cr.push([0, 0, i]);
	}

	// Generate all combinations
	const allPoints: number[][] = [];
	for(const a of ar) {
		for(const b of br) {
			for(const c of cr) {
				allPoints.push([
					a[0] + b[0] + c[0],
					a[1] + b[1] + c[1],
					a[2] + b[2] + c[2],
				]);
			}
		}
	}

	// Transform to fractional coordinates
	const invMatrix = inv(supercellMatrix);
	const fracPoints = multiply(allPoints, invMatrix);

	// Filter points within bounds
	const eps = 1e-10;
	const tVecs = fracPoints.filter((point) =>
		point.every((coord) => coord < 1 - eps && coord >= -eps)
	);

	// Validate result
	const expectedCount = Math.round(Math.abs(determinant(supercellMatrix)));
	if(tVecs.length !== expectedCount) {
		throw new Error("The number of transformed vectors mismatch.");
	}

	return tVecs;
};

/**
 * Generate image vectors (-1, 0, 1 for each periodic dimension)
 *
 * @returns Image vectors list
 */
const generateImageVectors = (): number[][] => {

	return [
		[-1, -1, -1],
		[-1, -1,  0],
		[-1, -1,  1],
		[-1,  0, -1],
		[-1,  0,  0],
		[-1,  0,  1],
		[-1,  1, -1],
		[-1,  1,  0],
		[-1,  1,  1],
		[0, -1, -1],
		[0, -1,  0],
		[0, -1,  1],
		[0,  0, -1],
		[0,  0,  0],
		[0,  0,  1],
		[0,  1, -1],
		[0,  1,  0],
		[0,  1,  1],
		[1, -1, -1],
		[1, -1,  0],
		[1, -1,  1],
		[1,  0, -1],
		[1,  0,  0],
		[1,  0,  1],
		[1,  1, -1],
		[1,  1,  0],
		[1,  1,  1]
	];
};

/**
 * Get the shortest vectors between two lists of coordinates taking into
 * account periodic boundary conditions and the lattice.
 *
 * @param lattice - Lattice to use
 * @param fcoords1 - First set of fractional coordinates. e.g. [0.5, 0.6, 0.7]
            or [[1.1, 1.2, 4.3], [0.5, 0.6, 0.7]]. It can be a single
            coord or any array of coords.
 * @param fcoords2 - Second set of fractional coordinates.
 * @param mask - Mask of matches that are not allowed.
            i.e. if mask[1,2] is True, then subset[1] cannot be matched
            to superset[2]
 * @param lllFracTol - Tolerance
 * @returns Displacement vectors from frac_coords1 to frac_coords2
            first index is frac_coords1 index, second is frac_coords2 index
 */
export const pbcShortestVectors = (lattice: Lattice,
								   fcoords1: number[][],
								   fcoords2: number[][],
								   mask: number[][],
								   lllFracTol?: number[]): {vecs: number[][][]; d2: number[][]} => {

	const nPbcImg = 27;

	// Generate image vectors (-1, 0, 1 for each periodic dimension)
	const fracImg = generateImageVectors();

	const m = getLLLmatrices(lattice);
	const lllInverse = m.inverseMapping;

	const coords1 = fcoords1.map((pt) => multiply(pt, lllInverse));
	const coords2 = fcoords2.map((pt) => multiply(pt, lllInverse));
	const matrix = m.matrix;

	const I = coords1.length;
	const J = coords2.length;

	// Convert fractional to Cartesian coordinates
	const cartF1 = multiply(coords1, matrix);
	const cartF2 = multiply(coords2, matrix);
	const cartImg = multiply(fracImg, matrix);

	const hasMask = mask !== null && mask !== undefined;
	const hasFtol = lllFracTol !== null && lllFracTol !== undefined;

	const vectors: number[][][] = Array(I).fill(0).map(() =>
		Array(J).fill(0).map(() => [0, 0, 0])
	);
	const d2: number[][] = Array(I).fill(0).map(() => Array<number>(J).fill(0));

	for(let i = 0; i < I; i++) {
		for(let j = 0; j < J; j++) {
			let withinFrac = false;

			if(!hasMask || mask[i][j] === 0) {
				withinFrac = true;

				// Check fractional tolerance if specified
				if(hasFtol) {
					for(let l = 0; l < 3; l++) {
						const fdist = coords2[j][l] - coords1[i][l];
						if(Math.abs(fdist - Math.round(fdist)) > lllFracTol[l]) {
							withinFrac = false;
							break;
						}
					}
				}

				if(withinFrac) {
					// Calculate base difference vector
					const preImg = [
						cartF2[j][0] - cartF1[i][0],
						cartF2[j][1] - cartF1[i][1],
						cartF2[j][2] - cartF1[i][2]
					];

					let best = 1e100;
					let bestK = 0;

					// Find shortest image
					for(let k = 0; k < nPbcImg; k++) {
						const da = preImg[0] + cartImg[k][0];
						const db = preImg[1] + cartImg[k][1];
						const dc = preImg[2] + cartImg[k][2];
						const d = da * da + db * db + dc * dc;

						if(d < best) {
							best = d;
							bestK = k;
						}
					}

					d2[i][j] = best;
					vectors[i][j][0] = preImg[0] + cartImg[bestK][0];
					vectors[i][j][1] = preImg[1] + cartImg[bestK][1];
					vectors[i][j][2] = preImg[2] + cartImg[bestK][2];
				}
			}

			if(!withinFrac) {
				d2[i][j] = 1e20;
				vectors[i][j] = [1e20, 1e20, 1e20];
			}
		}
	}

	return {vecs: vectors, d2};
};

/**
 *  Tests if all fractional coords in subset are contained in superset.
    Allows specification of a mask determining pairs that are not
    allowed to match to each other.
 *
 * @param subset - List of fractional coords
 * @param superset - List of fractional coords
 * @param fracTol - Tolerances (?)
 * @param mask - Mask of matches that are not allowed.
            i.e. if mask[1,2] is True, then subset[1] cannot be matched
            to superset[2]
 * @returns True if all of subset is in superset.
 */
export const isCoordSubsetPbc = (subset: number[][], superset: number[][], fracTol: number[], mask: number[][]): boolean => {

	let ok = false;
	const subsetLength = subset.length;
	const supersetLength = superset.length;
	for(let i=0; i < subsetLength; ++i) {
        ok = false;
        for(let j=0; j < supersetLength; ++j) {
            if(mask[i][j]) continue;
            ok = true;
            for(let k=0; k < 3; ++k) {
                const d = subset[i][k] - superset[j][k];
                if(Math.abs(pbc(d)) > fracTol[k]) {
                    ok = false;
                    break;
				}
			}
            if(ok) break;
		}
        if(!ok) break;
	}
    return ok;
};
