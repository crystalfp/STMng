/**
 * Worker main entry point.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-31
 */
import {fingerprintingMethods} from "./FingerprintingMethods";
import type {FingerprintingParameters} from "@/types";
import type {StructureReduced} from "./Accumulator";

export const worker = (params: FingerprintingParameters,
					   basis: number[],
					   positionsShared: SharedArrayBuffer,
					   atomsZShared: SharedArrayBuffer,
					   infoShared: SharedArrayBuffer,
					   fingerprintShared: SharedArrayBuffer,
					   weightsShared: SharedArrayBuffer): void => {

	const positions = new Float64Array(positionsShared);
	const atomsZ = new Int32Array(atomsZShared);

	// Info content in:
	//   0: id
	//   1: selectedIdx
	// Info content out:
	//   2: fingerprint dimension
	//   3: count sections
	//   4: section length
	const info = new Int32Array(infoShared);
	const fingerprint = new Float64Array(fingerprintShared);
	const weights = new Float64Array(weightsShared);

	const {method} = fingerprintingMethods[params.method];

	const status = method.init(params);
	if(status !== "") {
		info[2] = 0;
		info[3] = 0;
		info[4] = 0;
		return;
	}

	const structure: StructureReduced = {

		id: info[0],

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
		selectedIdx: info[1],
		energy: 0,

		fingerprint: [],
		countSections: 0,
		sectionLength: 0,

		weights: []
	};

	let i = 0;
	for(const atomZ of atomsZ) {

		if(structure.species.has(atomZ)) {
			const n = structure.species.get(atomZ)!;
			structure.species.set(atomZ, n+1);
		}
		else structure.species.set(atomZ, 1);
		structure.atomsZ.push(atomZ);
		structure.atomsPosition.push(positions[i], positions[i+1], positions[i+2]);
		i += 3;
	}

	// Compute fingerprint
	const results = method.fingerprinting(structure);

	for(let j=0; j < results.dimension; ++j) fingerprint[j] = structure.fingerprint[j];
	for(let j=0; j < results.countSections; ++j) weights[j] = structure.weights[j];

	// Save the resulting fingerprint dimension
	info[2] = results.dimension;
	info[3] = results.countSections;
	info[4] = results.sectionLength;
};
