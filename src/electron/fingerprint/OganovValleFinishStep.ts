/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-09
 */
import type {FingerprintsAccumulator} from "./Accumulator";
import type {VariableCompositionAccumulator} from "../variable/Accumulator";

/**
 * Post computation on all fingerprints. Here removes the centroid
 *
 * @param accumulator - The structures accumulator
 */
export const perSiteFinishStep = (accumulator: FingerprintsAccumulator): void => {

    const centroid: number[] = [];
    let nloaded = 0;

	// Compute the centroid of the fingerprints
	for(const {fingerprint, countSections, sectionLength}
		of accumulator.iterateSelectedStructures()) {

		const dimension = countSections*sectionLength;
        if(nloaded > 0) {
            for(let i=0; i < dimension; ++i) centroid[i] += fingerprint[i];
            ++nloaded;
        }
        else {
            centroid.length = dimension;
            for(let i=0; i < dimension; ++i) centroid[i] = fingerprint[i];
            nloaded = 1;
        }
	}

	const len = centroid.length;
	for(let i=0; i < len; ++i) {
		centroid[i] /= nloaded;
	}

	// Remove centroid from each fingerprint
	for(const {fingerprint} of accumulator.iterateSelectedStructures()) {

		for(let i=0; i < len; ++i) {
			fingerprint[i] -= centroid[i];
		}
	}

	// All done, reset accumulator
	centroid.length = 0;
};

/**
 * Post computation on all fingerprints. Here removes the centroid
 *
 * @param accumulator - The structures accumulator
 */
export const variablePerSiteFinishStep = (accumulator: VariableCompositionAccumulator,
										  indices: number[]): void => {

    const centroid: number[] = [];
    let nloaded = 0;

	// Compute the centroid of the fingerprints
	for(const idx of indices) {

		const entry = accumulator.getEntry(idx)!;
		const {fingerprint, countSections, sectionLength} = entry;

		const dimension = countSections*sectionLength;
        if(nloaded > 0) {
            for(let i=0; i < dimension; ++i) centroid[i] += fingerprint[i];
            ++nloaded;
        }
        else {
            centroid.length = dimension;
            for(let i=0; i < dimension; ++i) centroid[i] = fingerprint[i];
            nloaded = 1;
        }
	}

	const len = centroid.length;
	for(let i=0; i < len; ++i) {
		centroid[i] /= nloaded;
	}

	// Remove centroid from each fingerprint
	for(const idx of indices) {

		const entry = accumulator.getEntry(idx)!;
		const {fingerprint} = entry;

		for(let i=0; i < len; ++i) {
			fingerprint[i] -= centroid[i];
		}
	}

	// All done, reset accumulator
	centroid.length = 0;
};
