/**
 * Compute the matrix fingerprint
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-03-18
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
import {Slab} from "./Slab";
import {getCellVolume} from "./Helpers";
import {UpperTriangularMatrix} from "./UpperTriangularMatrix";
import type {FingerprintingParameters, FingerprintingResult} from "@/types";

/**
 * Create the function to accumulate one value for the fingerprint
 *
 * @param params - General parameters for fingerprinting computation
 * @param natoms - Total number of atoms in the unit cell
 * @param cellVolume - Computed cell volume
 * @param delta - Bin width
 * @param fp - Fingerprint upper triangular matrix to be filled
 * @returns The function that takes the vectors from the atom in the unit cell to
 * 				atoms in the extended unit cell and their distances to accumulate
 * 				the fingerprint value
 */
const setupComputeFP = (params: FingerprintingParameters,
						natoms: number,
						cellVolume: number,
						delta: number,
						fp: UpperTriangularMatrix): (vAB: number[], vAC: number[],
											magnitudeAB: number, magnitudeAC: number) => void => {

	const {binSize} = params;

	return (vAB: number[], vAC: number[], magnitudeAB: number, magnitudeAC: number): void => {

		// Row index
		const row = Math.round(magnitudeAB/delta);

		// Column index
		const col = Math.round(magnitudeAC/delta);

		// Value to add
		const dotProduct = vAB[0]*vAC[0] + vAB[1]*vAC[1] + vAB[2]*vAC[2];
		const vABcubed = magnitudeAB*magnitudeAB*magnitudeAB;
		const vACcubed = magnitudeAC*magnitudeAC*magnitudeAC;
		const peakValue = (dotProduct*dotProduct)/(4*Math.PI*vABcubed*vACcubed*natoms*(binSize/cellVolume));

		fp.add(row, col, peakValue);
	};
};

/**
 * Compute the Dot product matrix fingerprint on a given structure
 *
 * @param params - Parameters for the computation
 * @param basis - Basis vectors for the structure
 * @param natoms - Number of atoms
 * @param positions - Position of the atoms
 * @returns The computed fingerprint and weights
 */
export const fingerprintingDotMatrix = (params: FingerprintingParameters,
										basis: Float64Array,
										natoms: number,
										positions: Float64Array): FingerprintingResult => {

	// Extract the parameters
	const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;

	// Adjust the cutoff distance for the edge effects
	const adjustedCutoffForEdgeEffects = cutoffDistance + 4 * peakWidth;
	const nbins = Math.ceil(adjustedCutoffForEdgeEffects/binSize);
	const delta = adjustedCutoffForEdgeEffects/nbins;

	// Create the infinite slab
	const slab = new Slab(adjustedCutoffForEdgeEffects, areNanoclusters);

	// Compute cell volume
	const cellVolume = getCellVolume(basis, areNanoclusters);

	// Initialize the fingerprint histogram
	const fp = new UpperTriangularMatrix(nbins);
	fp.initSmoothingMatrix(peakWidth, delta, 9, 1e-6);
	const computeFP = setupComputeFP(params, natoms, cellVolume, delta, fp);

	// Compute the fingerprint
	if(!slab.computeVectorPairs(basis, natoms, positions, cutoffDistance, computeFP)) {
	    throw Error("In computeVectorPairs basis matrix is not invertible");
	}
	const fingerprint = fp.getVector();

	// Compute the weights
	const weights = new Float64Array(1);
	weights[0] = 1;

	// Return the fingerprint
	return {
		countSections: 1,
		sectionLength: fingerprint.length,
		fingerprint,
		weights
	};
};
