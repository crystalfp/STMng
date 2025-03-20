/**
 * Compute the matrix fingerprint
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-03-18
 */
import type {FingerprintingParameters, FingerprintingResult} from "@/types";

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
										positions: Float64Array,
										atomsZ: Int32Array): FingerprintingResult => {

    // TBD
	console.log("NOT YET IMPLEMENTED");
	void params;
	void basis;
	void natoms;
	void positions;
	void atomsZ;

	return {
		countSections: 0,
		sectionLength: 0,
		fingerprint: new Float64Array(0),
		weights: new Float64Array(0)
	};
};
