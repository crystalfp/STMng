/**
 * Compute fingerprints for the accumulated structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-09
 */
import type {FingerprintingMethod} from "@/types";
import type {FingerprintsAccumulator} from "./FingerprintsAccumulator";


/** Fingerprinting methods list */
const fpMethods: FingerprintingMethod[] = [
    {label: "Normalized diffraction",				needSizes: true},
    {label: "Mendeleev spectra",					needSizes: true},
    {label: "Chemical scale spectra",				needSizes: true},
    {label: "Per element diffraction",				needSizes: true},
    {label: "Distances per atom",					needSizes: false},
    {label: "Merged distances",						needSizes: false},
    {label: "Re-centered per element diffraction",	needSizes: true},
    {label: "Trimmed per element diffraction",		needSizes: false},
];

/**
 * Return the list of methods names
 *
 * @returns The list of fingerprinting methods for selector on the UI
 */
export const getFingerprintMethodsNames = (): FingerprintingMethod[] => {

	const out: FingerprintingMethod[] = [];
	for(const method of fpMethods) out.push(method);
	return out;
};

interface FingerprintingParameters {
	method: number;
	areNanoclusters: boolean;
	cutoffDistance: number;
	binSize: number;
	peakWidth: number;
}

/**
 * Compute fingerprints
 *
 * @param accumulator - The accumulated structures
 * @param params - Set of parameters needed for the computation
 * @returns Dimensionality of the fingerprints, zero on error
 */
export const fingerprinting = (accumulator: FingerprintsAccumulator,
							   params: FingerprintingParameters): number => {

	// No structures, no computation
	if(accumulator.size() === 0) return 0;

	// Get and verify parameters
	const {method, areNanoclusters, cutoffDistance, binSize, peakWidth} = params;
	if(method < 0 || method >= fpMethods.length) return 0;
	if(cutoffDistance <= 0 || binSize <= 0 || peakWidth <= 0) return 0;

console.log("FINGER", method,
		   areNanoclusters,
		   cutoffDistance,
		   binSize,
		   peakWidth);

	return 124; // TBD
};
