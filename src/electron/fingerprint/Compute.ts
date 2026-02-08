/**
 * Compute fingerprints for the accumulated structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-09
 */
import workerpool from "workerpool";
import os from "node:os";
import log from "electron-log";
import {publicDirPath} from "../modules/GetPublicPath";
import {perSiteFinishStep} from "./OganovValleFingerprint";
import {isRejected, isFulfilled} from "./AllSettledHelpers";
import type {FingerprintingParameters} from "@/types";
import type {FingerprintsAccumulator} from "./Accumulator";
import type {WorkerResults} from "./Worker";

/**
 * Computation result for the user interface
 * @notExported
 */
interface FingerprintingComputeResult {

	/** Computed fingerprint length */
	dimension: number;

	/** Error from fingerprinting, if any */
	error?: string;

	/** Simplified error for users */
	userError?: string;
}

/**
 * Routines related to computing fingerprinting for a set of structures
 */
export class Fingerprinting {

	/**
	 * Compute fingerprints
	 *
	 * @param accumulator - The accumulated structures
	 * @param params - Set of parameters needed for the computation
	 * @returns Dimensionality of the fingerprints, zero on error
	 */
	async compute(accumulator: FingerprintsAccumulator,
				  params: FingerprintingParameters): Promise<FingerprintingComputeResult> {

		// No structures selected, no computation
		const countStructures = accumulator.selectedSize();
		if(countStructures === 0) return {dimension: 0, error: "No structures selected"};

		// Get and verify parameters
		const {method, cutoffDistance, binSize, peakWidth,
			   areNanoclusters, processParallelism} = params;
		if(method < 0 || method > 2) {
			return {dimension: 0, error: "Invalid fingerprinting method"};
		}
		if(cutoffDistance <= 0 || binSize <= 0 || peakWidth < 0) {
			return {dimension: 0, error: "Invalid fingerprinting parameters"};
		}

		// Find the fingerprint worker
		const worker = publicDirPath("Worker.js", true);

		// Compute the parallelism
		let availableParallelism = os.availableParallelism();
		if(availableParallelism > 1) {
			/* oxlint-disable-next-line @stylistic/space-before-function-paren */
			availableParallelism = (processParallelism ?
											2*availableParallelism :
											availableParallelism)-1;
		}
		if(countStructures < availableParallelism) availableParallelism = countStructures;

		// Prepare the worker pool
		const pool = workerpool.pool(worker, {
			minWorkers: "max",
			maxWorkers: availableParallelism,
			workerType: processParallelism ? "process" : "thread"
		});
		const promises: workerpool.Promise<WorkerResults>[] = [];

		// For each structure, compute the fingerprint
		for(const structure of accumulator.iterateSelectedStructures()) {

			// Extract data to send to the worker
			const lenP = structure.atomsPosition.length;
			const positions = new Float64Array(lenP);
			for(let i=0; i < lenP; ++i) positions[i] = structure.atomsPosition[i];

			const lenZ = structure.atomsZ.length;
			const atomsZ = new Int32Array(lenZ);
			for(let i=0; i < lenZ; ++i) atomsZ[i] = structure.atomsZ[i];

			const basis = new Float64Array(areNanoclusters? 0 : 9);
			if(!areNanoclusters) for(let i=0; i < 9; ++i) basis[i] = structure.basis[i];

			const result = pool.exec("fingerprinting", [
				params,
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

		if(results.length === 0) {
			return {dimension: 0, error: "Error starting the fingerprinting worker pool"};
		}

		let idx = 0;
		let fingerprintSize = 0;
		for(const structure of accumulator.iterateSelectedStructures()) {

			const oneResult = results[idx];
			if(isRejected(oneResult)) {
				const reason = oneResult.reason as string;
				return {dimension: 0,
						userError: `Probable out of memory error on step ${structure.step}`,
						error: `Error on step ${structure.step}\n${reason}`};
			}

			if(isFulfilled(oneResult)) {
				const {countSections, sectionLength, fp, w} = oneResult.value;
				++idx;

				if(countSections === 0 || sectionLength === 0) {
					return {dimension: 0, error: `No fingerprint computed for step ${structure.step}`};
				}
				const fingerprintArray = fp.message as Float64Array;
				const weightsArray = w.message as Float64Array;

				// Get fingerprint size
				if(fingerprintSize === 0) fingerprintSize = countSections*sectionLength;
				if(fingerprintSize !== countSections*sectionLength) {
					return {dimension: 0, error: `Fingerprinting dimension has changed for step ${structure.step}`};
				}

				// Access the structure
				const {fingerprint, weights} = structure;

				// Save the resulting fingerprint dimension
				structure.countSections = countSections;
				structure.sectionLength = sectionLength;

				// Save the fingerprint
				fingerprint.length = fingerprintSize;
				for(let i=0; i < fingerprintSize; ++i) fingerprint[i] = fingerprintArray[i];

				// Save the weights
				weights.length = countSections;
				for(let i=0; i < countSections; ++i) weights[i] = weightsArray[i];
			}
		}

		// For methods that need a last global step
		if(method === 1) perSiteFinishStep(accumulator);

		return {dimension: fingerprintSize};
	}
}
