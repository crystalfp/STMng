/**
 * Compute fingerprints for the accumulated structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-09
 */
import workerpool from "workerpool";
import {app} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {fingerprintingMethods} from "./FingerprintingMethods";
import type {FingerprintingMethodName, FingerprintingParameters} from "@/types";
import type {FingerprintsAccumulator} from "./Accumulator";

interface FingerprintingComputeResult {

	/** Computed fingerprint length */
	dimension: number;

	/** Error from fingerprinting, if any */
	error?: string;
}

export class Fingerprinting {

	/**
	 * Return the list of methods names
	 *
	 * @returns The list of fingerprinting methods for the selector on the UI
	 */
	getFingerprintMethodsNames(): FingerprintingMethodName[] {

		const out: FingerprintingMethodName[] = [];
		for(const entry of fingerprintingMethods) {
			out.push({
				label: entry.label,
				needSizes: entry.needSizes,
				forNanoclusters: entry.forNanoclusters
			});
		}
		return out;
	}

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
		const {method, cutoffDistance, binSize, peakWidth} = params;
		if(method < 0 || method >= fingerprintingMethods.length) {
			return {dimension: 0, error: "Invalid fingerprinting method"};
		}
		if(cutoffDistance <= 0 || binSize <= 0 || peakWidth <= 0) {
			return {dimension: 0, error: "Invalid fingerprinting parameters"};
		}


		const pool = workerpool.pool({
			minWorkers: "max",
			workerType: "thread"
		});
		const promises: ReturnType<typeof pool.exec>[] = [];

		// Find the fingerprint worker
		const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		const worker = app.isPackaged ?
							path.resolve(process.resourcesPath,
													 "app.asar.unpacked/dist/Worker.js") :
							path.join(mainSourceDirectory, "..", "public", "Worker.js");

		for(const structure of accumulator.iterateSelectedStructures()) {

		// 	const result = pool.exec(worker, [1_000_000]).catch((error) => {
		// 		console.error(error);
		// 		return {dimension: 0, error: "Invalid fingerprinting method"};
		// 	});
		// 	promises.push(result);
		void structure;
		void worker;
		}
		await Promise.all(promises);

		pool.terminate();

		return {dimension: 0}; // TBD
	}

	/**
	 * Compute fingerprints
	 *
	 * @param accumulator - The accumulated structures
	 * @param params - Set of parameters needed for the computation
	 * @returns Dimensionality of the fingerprints, zero on error
	 */
	computeOriginal(accumulator: FingerprintsAccumulator,
			params: FingerprintingParameters): FingerprintingComputeResult {

		// No structures selected, no computation
		const countStructures = accumulator.selectedSize();
		if(countStructures === 0) return {dimension: 0, error: "No structures selected"};

		// Get and verify parameters
		const {method, cutoffDistance, binSize, peakWidth} = params;
		if(method < 0 || method >= fingerprintingMethods.length) {
			return {dimension: 0, error: "Invalid fingerprinting method"};
		}
		if(cutoffDistance <= 0 || binSize <= 0 || peakWidth <= 0) {
			return {dimension: 0, error: "Invalid fingerprinting parameters"};
		}

		const status = fingerprintingMethods[method].method.init(params);
		if(status !== "") return {dimension: 0, error: status};

		let fingerprintSize = 0;
		for(const structure of accumulator.iterateSelectedStructures()) {

			// Compute fingerprint
			const results = fingerprintingMethods[method].method.fingerprinting(structure);

			// Get fingerprint size
			if(fingerprintSize === 0) fingerprintSize = results.dimension;
			if(fingerprintSize !== results.dimension) {
				return {dimension: 0, error: "Fingerprinting dimension has changed"};
			}

			// Save the resulting fingerprint dimension
			structure.countSections = results.countSections;
			structure.sectionLength = results.sectionLength;
		}

		// For methods that need a last global step
		fingerprintSize = fingerprintingMethods[method].method.finish(accumulator);

		return {dimension: fingerprintSize};
	};
}
