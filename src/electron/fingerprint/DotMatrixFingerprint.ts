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
// import fs from "node:fs";
/**
 * Create the function to accumulate one value for the fingerprint
 *
 * @param params - General parameters for fingerprinting computation
 * @param natoms - Total number of atoms in the unit cell
 * @param cellVolume - Computed cell volume
 * @param cutoffSquared - Cutoff distance squared
 * @param delta - Bin width
 * @param nbins - Number of bins
 * @param fp - Fingerprint array to be filled
 * @returns The function that takes the vectors from the atom in the unit cell to
 * 				atoms in the extended unit cell
 */
const setupComputeFP = (params: FingerprintingParameters,
						natoms: number,
						cellVolume: number,
						cutoffSquared: number,
						delta: number,
						nbins: number,
						fp: Float64Array): (vAB: number[], vAC: number[],
											magnitudeAB: number, magnitudeAC: number) => void => {

	const {areNanoclusters, binSize, peakWidth} = params;

	return (vAB: number[], vAC: number[], magnitudeAB: number, magnitudeAC: number): void => {

		const dotProduct = vAB[0]*vAC[0] + vAB[1]*vAC[1] + vAB[2]*vAC[2];
		// const dotProduct = vAB[0]*vAC[0] + vAB[1]*vAC[1] + vAB[2]*vAC[2]/(magnitudeAB*magnitudeAC);
		const peakPosition = dotProduct + cutoffSquared + 4*peakWidth;

		// Compute the peak value
		// const peakValue = areNanoclusters ?
		// 					1/(Nj*Ni*binSize) :
		// 					1/(4*Math.PI*Rij*Rij*(Nj/cellVolume)*2*Ni*binSize);

		// const peakValue = 1/(4*Math.PI*magnitudeAB*magnitudeAC*magnitudeAB*magnitudeAC*natoms*(binSize/cellVolume));
		// const peakValue = 1/(4*Math.PI*magnitudeAB*magnitudeAC*natoms*(binSize/cellVolume));
		// const peakValue = 1/(4*Math.PI*Math.sqrt(magnitudeAB*magnitudeAC)*natoms*(binSize/cellVolume));
		const peakValue = 1/(4*Math.PI*natoms*(binSize/cellVolume));

		// Smooth the peak and accumulate
		smoothPeak(peakValue, peakPosition, delta, nbins, fp, 0, peakWidth);

		void areNanoclusters;
		void binSize;
		void cellVolume;
		void magnitudeAB;
		void magnitudeAC;
	};
};

/**
 * Compute the Dot produce matrix fingerprint on a given structure
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
	const cutoffSquared = cutoffDistance*cutoffDistance;
	// const cutoffSquared = 1;
	const adjustedCutoffForEdgeEffects = 2*cutoffSquared + 8 * peakWidth;
	const nbins = Math.ceil(adjustedCutoffForEdgeEffects/binSize);
	const delta = adjustedCutoffForEdgeEffects/nbins;

	// Create the infinite slab
	const slab = new Slab(cutoffDistance+4*peakWidth, areNanoclusters);

	// Compute cell volume
	const cellVolume = getCellVolume(basis, areNanoclusters);

	// Initialize the fingerprint histogram
	const fingerprint = new Float64Array(nbins);
	fingerprint.fill(0);
	const computeFP = setupComputeFP(params, natoms, cellVolume, cutoffSquared, delta, nbins, fingerprint);

	// Compute the fingerprint
	slab.computeVectorPairs(basis, natoms, positions, computeFP);

	// const fd = fs.openSync("fingerprint.txt", "w");
	// // Normalize the fingerprint
	// for(let i=0; i < nbins; ++i) {
	// 	// fingerprint[i] /= natoms; // TBD
	// 	// fingerprint[i] -= 10;
	// 	fs.writeSync(fd, `${i} ${fingerprint[i]}\n`);
	// }
	// fs.close(fd);

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
