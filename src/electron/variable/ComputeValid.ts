/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-21
 */
import {VariableCompositionAccumulator} from "./Accumulator";

/**
 * Compute valid entries parameters
 */
export interface ComputeValidParameters {
	fingerprintingMethod: number;
	forceCutoff: boolean;
	manualCutoffDistance: number;
	distanceMethod: number;
	binSize: number;
	peakWidth: number;
	fixTriangleInequality: boolean;
	duplicatesThreshold: number;
}

/**
 * Return available fingerprinting methods names
 *
 * @returns List of methods names
 */
export const fingerprintMethodsNames = (): string[] => {

	return [
		"Oganov-Valle fingerprint",
		"Oganov-Valle per-site fingerprint",
		"Dot-matrix fingerprint"
	];
};

/**
 * Return available distance methods names
 *
 * @returns List of methods names
 */
export const distanceMethodsNames = (): string[] => {

	return [
		"Cosine distance",
		"Euclidean distance",
		"Minkowski distance of order ⅓",
	];
};

/**
 * Mark duplicated structures
 *
 * @param accumulator - Accumulated structures
 * @param indices - List of indices to be analyzed
 * @param params - Parameters for the computation
 * @returns Number of structures considered valid
 */
export const computeValid = (accumulator: VariableCompositionAccumulator,
							 indices: number[],
							 params: ComputeValidParameters): number => {

	// Compute fingerprints
	for(const idx of indices) {
		const entry = accumulator.getEntry(idx);
		if(entry === undefined) continue;
		entry.enabled = true;

		// Compute fingerprint
		// TBD
		void params;
	}

	// Compute distance matrix

	// Remove duplicates

	return indices.length; // TBD For now does nothing
};
