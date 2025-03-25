/**
 * Compute the matrix fingerprint
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-03-18
 */
import {Slab} from "./Slab";
import {smoothPeak} from "./Smooth";
import {getCellVolume} from "./Helpers";
import type {FingerprintingParameters, FingerprintingResult} from "@/types";

const setupComputeFP = (params: FingerprintingParameters,
						cellVolume: number,
						cutoffSquared: number,
						delta: number,
						nbins: number,
						fp: Float64Array): (vAB: number[], vAC: number[]) => void => {

	const {areNanoclusters, binSize, peakWidth} = params;

	return (vAB: number[], vAC: number[]): void => {

		const dotProduct = vAB[0]*vAC[0] + vAB[1]*vAC[1] + vAB[2]*vAC[2];
		const value = dotProduct + cutoffSquared + 4*peakWidth;
		// const idx = Math.floor(nbins*(value+cutoffSquared+0.5*binSize)/(2*cutoffSquared+binSize));
		// fp[idx] += 1;

		// Compute the peak value Fing
		// const fing = areNanoclusters ?
		// 					1/(Nj*Ni*binSize) :
		// 					1/(4*Math.PI*Rij*Rij*(Nj/cellVolume)*2*Ni*binSize);
		const fing = 1;
		// Smooth the peak and accumulate
		smoothPeak(fing, value, delta, nbins, fp, 0, peakWidth);

		void areNanoclusters;
		void binSize;
		void cellVolume;
	};
};

/**
 * Compute the Dot produce matrix fingerprint on a given structure
 *
 * @param params - Parameters for the computation
 * @param basis - Basis vectors for the structure
 * @param natoms - Number of atoms
 * @param positions - Position of the atoms
 * @param atomsZ - Atoms type
 * @returns The computed fingerprint and weights
 */
export const fingerprintingDotMatrix = (params: FingerprintingParameters,
										basis: Float64Array,
										natoms: number,
										positions: Float64Array): FingerprintingResult => {

	// Extract the parameters
	const {areNanoclusters, cutoffDistance, binSize, peakWidth} = params;

	// Adjust the cutoff distance for the edge effects
	const cutoffSquared = cutoffDistance*cutoffDistance;
	const adjustedCutoffForEdgeEffects = 2*cutoffSquared + 8 * peakWidth;
	const nbins = Math.ceil(adjustedCutoffForEdgeEffects/binSize);
	const delta = adjustedCutoffForEdgeEffects/nbins;

	// Create the infinite slab
	const slab = new Slab(cutoffDistance+4*peakWidth, areNanoclusters);
	// const slab = new Slab(adjustedCutoffForEdgeEffects, areNanoclusters);

	// Compute cell volume
	const cellVolume = getCellVolume(basis, areNanoclusters);

	// Initialize the fingerprint histogram
	const fingerprint = new Float64Array(nbins);
	fingerprint.fill(-1);
	const computeFP = setupComputeFP(params, cellVolume, cutoffSquared, delta, nbins, fingerprint);

	// Compute the fingerprint
	slab.computeVectorPairs(basis, natoms, positions, computeFP);

	// Compute the weights
	const weights = new Float64Array(1);
	weights[0] = 1;

	// Return the fingerprint
	return {
		countSections: 1,
		sectionLength: nbins,
		fingerprint,
		weights
	};
};
