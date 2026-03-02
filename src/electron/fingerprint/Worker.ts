/**
 * Fingerprinting worker main entry point.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-31
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import workerpool from "workerpool";
import {fingerprintingOganovValle} from "./OganovValleFingerprint";
import {fingerprintingDotMatrix} from "./DotMatrixFingerprint";
import type {FingerprintingParameters, FingerprintingResult} from "@/types";

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
	let results: FingerprintingResult;
	switch(params.method) {
		case 0:
		case 1:
			results = fingerprintingOganovValle(params, basis, natoms, positions, atomsZ);
			break;
		case 2:
			results = fingerprintingDotMatrix(params, basis, natoms, positions);
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
