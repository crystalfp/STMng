/**
 * The Oganov-Valle fingerprinting and the per-site variant.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-08
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
import {smoothPeak} from "./Smooth";
import {getCellVolume} from "./Helpers";
import type {FingerprintingParameters, FingerprintingResult} from "@/types";

/**
 * Rescale lengths to be multiples of r0
 * r0 is roughly similar to the mean atomic radius
 *
 * @param basis - Basis vectors for the structure
 * @param natoms - Number of atoms
 * @param positions - Position of the atoms
 * @returns Rescaled cell volume
 */
const rescaleLengths = (basis: Float64Array, natoms: number, positions: Float64Array): number => {

	// Compute cell volume
	const cellVolume = getCellVolume(basis);

	// Compute scaling parameter
	const r0 = Math.cbrt(cellVolume/natoms)/2;

	// Scale basis
	for(let i=0; i < 9; ++i) basis[i] /= r0;

	// Scale positions
	for(let i=0; i < natoms; ++i) {
		positions[i*3]   /= r0;
		positions[i*3+1] /= r0;
		positions[i*3+2] /= r0;
	}

	// Return rescaled cell volume
	return cellVolume/(r0*r0*r0);
};

/**
 * Compute the Oganov-Valle fingerprint on a given structure
 *
 * @param params - Parameters for the computation
 * @param basis - Basis vectors for the structure
 * @param natoms - Number of atoms
 * @param positions - Position of the atoms
 * @param atomsZ - Atoms type
 * @returns The computed fingerprint and weights
 */
export const fingerprintingOganovValle = (params: FingerprintingParameters,
										  basis: Float64Array,
										  natoms: number,
										  positions: Float64Array,
										  atomsZ: Int32Array): FingerprintingResult => {

	const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;

	// Adjust the cutoff distance for the edge effects
	const adjustedCutoffForEdgeEffects = cutoffDistance + 4 * peakWidth;
	const nbins = Math.ceil(adjustedCutoffForEdgeEffects/binSize);
	const delta = adjustedCutoffForEdgeEffects/nbins;

	// Create the infinite slab
	const slab = new Slab(adjustedCutoffForEdgeEffects, areNanoclusters);

	// Count species
	const species = new Map<number, number>();
	for(let j=0; j < natoms; ++j) {
		const atomZ = atomsZ[j];
		const n = species.get(atomZ) ?? 0;
		species.set(atomZ, n+1);
	}

	// Initialize counts
	const countSpecies = species.size;
	const countSections = (countSpecies*(countSpecies+1))/2;

	// Initialize the fingerprint histogram
	const fingerprint = new Float64Array(nbins*countSections);
	fingerprint.fill(-1);

	// Rescale lengths to be multiples of r0. r0 is roughly similar to the mean atomic radius
	const rescaledCellVolume = areNanoclusters ? 1 : rescaleLengths(basis, natoms, positions);

	// With the infinite slab compute interatomic distances
	slab.computeInteratomicDistances(basis, natoms, atomsZ, positions);

	// Create ordered list of atom z values and list of positions
	const orderedZ = [...species.keys()].toSorted((a, b) => a-b);
	const atomsIdx = new Map<number, number>();
	let pos = 0;
	for(const atomZ of orderedZ) atomsIdx.set(atomZ, pos++);

	// For each pair of Z values, compute the peak, smooth and accumulate it
	for(const Zi of orderedZ) {

		const Ni = species.get(Zi)!;
		const Pi = atomsIdx.get(Zi)!;

		const distances = slab.getDistancesForZ(Zi);
		for(const [Zj, Rij] of distances) {

			const Nj = species.get(Zj)!;
			const Pj = atomsIdx.get(Zj)!;

			// Compute the peak value Fing
			let fing = areNanoclusters ?
								1/(Nj*Ni*binSize) :
								1/(4*Math.PI*Rij*Rij*(Nj/rescaledCellVolume)*2*Ni*binSize);

			// The components AA, BB, etc. should be counted twice
			if(Zi === Zj) fing *= 2;

			// Compute the section index for this part
			const idxSection = (Pj >= Pi) ?
									Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
									Pj*countSpecies-(Pj*(Pj+1))/2+Pi;

			// Smooth the peak and accumulate
			smoothPeak(fing, Rij, delta, nbins, fingerprint,
						idxSection*nbins, peakWidth);
		}
	}
	slab.reset();

	// Compute weights
	const len = orderedZ.length;
	const weights = new Float64Array(countSections);

	for(let i=0; i < len; ++i) {
		const Zi = orderedZ[i];
		const Ni = species.get(Zi)!;
		const Pi = atomsIdx.get(Zi)!;
		for(let j=i; j < len; ++j) {
			const Zj = orderedZ[j];
			const Nj = species.get(Zj)!;
			const Pj = atomsIdx.get(Zj)!;
			const idxSection = (Pj >= Pi) ?
									Pi*countSpecies-(Pi*(Pi+1))/2+Pj :
									Pj*countSpecies-(Pj*(Pj+1))/2+Pi;
			weights[idxSection] = Ni*Nj;
		}
	}

	// Normalize the weights and store them
	let w = 0;
	for(let i=0; i < countSections; ++i) w += weights[i];
	for(let i=0; i < countSections; ++i) weights[i] /= w;

	return {countSections, sectionLength: nbins, fingerprint, weights};
};
