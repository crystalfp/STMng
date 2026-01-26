/**
 * Mark duplicated structures for removal.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-21
 */
import log from "electron-log";
import os from "node:os";
import workerpool from "workerpool";
import {publicDirPath} from "../modules/GetPublicPath";
import {VariableCompositionAccumulator} from "./Accumulator";
import {isRejected, isFulfilled} from "../fingerprint/AllSettledHelpers";
import {variablePerSiteFinishStep} from "../fingerprint/OganovValleFingerprint";
import {computeDistances} from "./ComputeDistances";
import {measuringMethods} from "../fingerprint/DistanceMethods";
import {removeDuplicatePoints} from "./RemoveDuplicates";
import type {WorkerResults} from "../fingerprint/Worker";

/**
 * Parameters for compute valid entries
 */
export interface ComputeValidParameters {
	/** Fingerprinting method */
	method: number;
	/** Forced manual cutoff */
	forceCutoff: boolean;
	/** Manual cutoff distance */
	manualCutoffDistance: number;
	/** Distance method */
	distanceMethod: number;
	/** Bin size for fingerprint discretization */
	binSize: number;
	/** Peak width for fingerprint discretization */
	peakWidth: number;
	/** If the triangle inequality should be checked and fixed for all distances */
	fixTriangleInequality: boolean;
	/** Threshold to remove duplicates */
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

	const out: string[] = [];
	for(const method of measuringMethods) out.push(method.label);
	return out;
};

/**
 * Return status from computeValid
 * @notExported
 */
interface ComputeValidResult {

	/** Count of valid structures for the component */
	count: number;
	/** Error message, if any */
	error?: string;
}

/**
 * Mark duplicated structures
 *
 * @param accumulator - Accumulated structures
 * @param indices - List of indices to be analyzed
 * @param params - Parameters for the computation
 * @returns Number of structures considered valid and eventually an error message
 */
export const computeValid = async (accumulator: VariableCompositionAccumulator,
							 	   indices: number[],
								   params: ComputeValidParameters): Promise<ComputeValidResult> => {

	// Get parameters
	const {method, manualCutoffDistance,
		   duplicatesThreshold, peakWidth, distanceMethod,
		   fixTriangleInequality, binSize} = params;
	const countStructures = indices.length;

	// Find the fingerprint worker
	const worker = publicDirPath("Worker.js", true);

	// Compute the parallelism
	let availableParallelism = os.availableParallelism();
	if(availableParallelism > 1) {
		availableParallelism = 2*availableParallelism-1;
	}
	if(countStructures < availableParallelism) availableParallelism = countStructures;

	// Prepare the worker pool
	const pool = workerpool.pool(worker, {
		minWorkers: "max",
		maxWorkers: availableParallelism,
		workerType: "process"
	});
	const promises: workerpool.Promise<WorkerResults>[] = [];

	// Compute fingerprints
	for(const idx of indices) {

		const entry = accumulator.getEntry(idx);
		if(entry === undefined) continue;
		entry.enabled = true;

		// Extract data to send to the worker to compute fingerprint
		const lenP = entry.atomsPosition.length;
		const positions = new Float64Array(lenP);
		for(let i=0; i < lenP; ++i) positions[i] = entry.atomsPosition[i];

		const lenZ = entry.atomsZ.length;
		const atomsZ = new Int32Array(lenZ);
		for(let i=0; i < lenZ; ++i) atomsZ[i] = entry.atomsZ[i];

		const basis = new Float64Array(9);
		for(let i=0; i < 9; ++i) basis[i] = entry.basis[i];

		const fpParams = {
			method,
			areNanoclusters: false,
			cutoffDistance: manualCutoffDistance,
			binSize,
			peakWidth
		};

		const result = pool.exec("fingerprinting", [
			fpParams,
			basis,
			lenZ,
			positions,
			atomsZ,
		], {transfer: [basis.buffer, positions.buffer, atomsZ.buffer]}) as workerpool.Promise<WorkerResults>;

		promises.push(result);
	}

	const results = await Promise.allSettled(promises).catch((error: unknown) => {
		log.error("Error from the worker pool.", error);
		return [];
	});

	// Release the pool
	pool.terminate();

	const len = results.length;
	if(len === 0) {
		const message = "Error starting the fingerprinting worker pool";
		log.error(message);
		return {count: 0, error: message};
	}

	let fingerprintSize = 0;
	for(let j=0; j < len; ++j) {

		const idx = indices[j];
		const entry = accumulator.getEntry(idx)!;
		const oneResult = results[j];

		if(isRejected(oneResult)) {
			const reason = oneResult.reason as string;
			const message = `Error on step ${entry.step}\n${reason}`;
			log.error(message);
			return {count: 0, error: message};
		}

		if(isFulfilled(oneResult)) {
			const {countSections, sectionLength, fp, w} = oneResult.value;

			if(countSections === 0 || sectionLength === 0) {
				const message = `No fingerprint computed for step ${entry.step}`;
				log.error(message);
				return {count: 0, error: message};
			}
			const fingerprintArray = fp.message as Float64Array;
			const weightsArray = w.message as Float64Array;

			// Get fingerprint size
			if(fingerprintSize === 0) fingerprintSize = countSections*sectionLength;
			if(fingerprintSize !== countSections*sectionLength) {
				const message = `Fingerprinting dimension has changed for step ${entry.step} ` +
						  		`(${fingerprintSize} -> ${countSections*sectionLength})`;
				log.error(message);
				return {count: 0, error: message};
			}

			// Access the structure
			const {fingerprint, weights} = entry;

			// Save the resulting fingerprint dimension
			entry.countSections = countSections;
			entry.sectionLength = sectionLength;

			// Save the fingerprint
			fingerprint.length = fingerprintSize;
			for(let i=0; i < fingerprintSize; ++i) fingerprint[i] = fingerprintArray[i];

			// Save the weights
			weights.length = countSections;
			for(let i=0; i < countSections; ++i) weights[i] = weightsArray[i];
		}
	}

	// For methods that need a last global step
	if(method === 1) variablePerSiteFinishStep(accumulator, indices);

	// Compute distance matrix
	const distances = computeDistances(accumulator, indices,
									   distanceMethod, fixTriangleInequality);

	// Remove duplicates
	const remaining = removeDuplicatePoints(accumulator, indices, distances,
										    duplicatesThreshold);

	return {count: remaining};
};
