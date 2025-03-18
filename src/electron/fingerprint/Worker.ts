/**
 * Fingerprinting worker main entry point.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-31
 */
import workerpool from "workerpool";
import {fingerprintingOganovValle} from "./OganovValleFingerprint";
import type {FingerprintingParameters} from "@/types";

/** The results returned to the caller */
export interface WorkerResults {

    /** Number of sections in the fingerprint */
    countSections: number;

    /** Length of each section of the fingerprint */
	sectionLength: number;

	/** The computed fingerprint as a transferable typed array */
	fp: InstanceType<typeof workerpool.Transfer>;

	/** The computed weights as a transferable typed array */
	w: InstanceType<typeof workerpool.Transfer>;
}

/**
 * Worker routine for fingerprinting
 *
 * @param params - Set of parameters needed for the computation
 * @param basis - The basis set
 * @param positions - Atoms positions
 * @param atomsZ - Atoms types
 * @returns The fingerprinting results returned to the caller
 */
const worker = (params: FingerprintingParameters,
				basis: Float64Array,
				natoms: number,
				positions: Float64Array,
				atomsZ: Int32Array): WorkerResults => {

	// Compute fingerprint
	let results: ReturnType<typeof fingerprintingOganovValle>;
	switch(params.method) {
		case 0:
		case 1:
			results = fingerprintingOganovValle(params, basis, natoms, positions, atomsZ);
			break;
		case 2:
			results = {
				countSections: 0,
				sectionLength: 0,
				fingerprint: new Float64Array(0),
				weights: new Float64Array(0)
			};
			break;
		default:
			throw Error(`Invalid fingerprinting method ${params.method}`);
	}

	return {
		countSections: results.countSections,
		sectionLength: results.sectionLength,
		fp: new workerpool.Transfer(results.fingerprint, [results.fingerprint.buffer]),
		w:  new workerpool.Transfer(results.weights, [results.weights.buffer])
	};
};

/** Register the worker routine */
workerpool.worker({fingerprinting: worker});
