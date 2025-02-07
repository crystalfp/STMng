/**
 * Fingerprinting worker main entry point.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-31
 */
import workerpool from "workerpool";
import {fingerprintingMethods} from "./FingerprintingMethods";
import type {FingerprintingParameters} from "@/types";
import type {StructureReduced} from "./Accumulator";

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
				positions: Float64Array,
				atomsZ: Int32Array): WorkerResults => {

	// Initialize the chosen fingerprinting method
	const {method} = fingerprintingMethods[params.method];

	method.init(params);

	// Populate a minimal structure to drive the computation
	const structure: StructureReduced = {

		id: 0,

		basis: [
			basis[0], basis[1], basis[2],
			basis[3], basis[4], basis[5],
			basis[6], basis[7], basis[8]
		],
		minRadius: 0,

		atomsPosition: [],
		atomsZ: [],
		species: new Map<number, number>(),

		selected: true,
		selectedIdx: 0,
		energy: 0,

		fingerprint: [],
		countSections: 0,
		sectionLength: 0,

		weights: []
	};

	let i3 = 0;
	for(const atomZ of atomsZ) {

		if(structure.species.has(atomZ)) {
			const n = structure.species.get(atomZ)!;
			structure.species.set(atomZ, n+1);
		}
		else structure.species.set(atomZ, 1);
		structure.atomsZ.push(atomZ);
		structure.atomsPosition.push(positions[i3], positions[i3+1], positions[i3+2]);
		i3 += 3;
	}

	// Compute fingerprint
	const results = method.fingerprinting(structure);

	// Return the results
	const fingerprint = new Float64Array(results.dimension);
	for(let j=0; j < results.dimension; ++j) fingerprint[j] = structure.fingerprint[j];

	const weights = new Float64Array(results.countSections);
	for(let j=0; j < results.countSections; ++j) weights[j] = structure.weights[j];

	return {
		countSections: results.countSections,
		sectionLength: results.sectionLength,
		fp: new workerpool.Transfer(fingerprint, [fingerprint.buffer]),
		w:  new workerpool.Transfer(weights, [weights.buffer])
	};
};

/** Register the worker routine */
workerpool.worker({fingerprinting: worker});
