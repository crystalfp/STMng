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
import log from "electron-log";
import {fingerprintingMethods} from "./FingerprintingMethods";
import type {FingerprintingMethodName, FingerprintingParameters} from "@/types";
import type {FingerprintsAccumulator} from "./Accumulator";
import type {WorkerResults} from "./Worker";

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

		// Find the fingerprint worker
		const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		const worker = app.isPackaged ?
							path.resolve(process.resourcesPath,
													 "app.asar.unpacked/dist/Worker.js") :
							path.join(mainSourceDirectory, "..", "public", "Worker.js");

		// Prepare the worker pool
		const pool = workerpool.pool(worker, {
			minWorkers: "max",
			workerType: "thread"
		});
		const promises: ReturnType<typeof pool.exec>[] = [];

		for(const structure of accumulator.iterateSelectedStructures()) {

			// Extract data to send to the worker
			const lenP = structure.atomsPosition.length;
			const positions = new Float64Array(lenP);
			for(let i=0; i < lenP; ++i) positions[i] = structure.atomsPosition[i];

			const lenZ = structure.atomsZ.length;
			const atomsZ = new Int32Array(lenZ);
			for(let i=0; i < lenZ; ++i) atomsZ[i] = structure.atomsZ[i];

			const basis = new Float64Array(9);
			for(let i=0; i < 9; ++i) basis[i] = structure.basis[i];

			const result = pool.exec("fingerprinting", [
				params,
				basis,
				positions,
				atomsZ,
			], {transfer: [basis.buffer, positions.buffer, atomsZ.buffer]})
			.catch((error) => {
				log.error("Error sending to the worker pool", error);
				return {dimension: 0, error: "Error sending to the worker pool"};
			});
			promises.push(result);
		}
		const results = await Promise.all(promises) as WorkerResults[];

		let idx = 0;
		let fingerprintSize = 0;
		for(const structure of accumulator.iterateSelectedStructures()) {

			const {countSections, sectionLength, fp, w} = results[idx++];

			if(countSections === 0 || sectionLength === 0) {
				return {dimension: 0, error: "No fingerprint"};
			}
			const fingerprintArray = fp.message as Float64Array;
			const weightsArray = w.message as Float64Array;

			// Get fingerprint size
			if(fingerprintSize === 0) fingerprintSize = countSections*sectionLength;
			if(fingerprintSize !== countSections*sectionLength) {
				return {dimension: 0, error: "Fingerprinting dimension has changed"};
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

		// Release the pool
		pool.terminate();

		// For methods that need a last global step
		fingerprintSize = fingerprintingMethods[method].method.finish(accumulator);

		return {dimension: fingerprintSize};
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
