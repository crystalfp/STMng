/**
 * Final global step to remove the centroid from each fingerprint
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-09
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
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
