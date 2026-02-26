/**
 * The analysis methods that produce data for the Fingerprinting chart window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-28
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
import {getCellVolume} from "./Helpers";
import type {DistanceMatrix} from "./Distances";
import type {FingerprintsAccumulator} from "./Accumulator";

/**
 * Prepare the histogram of distances. The distances goes from zero to the max.
 *
 * @param distanceMatrix - Distance matrix
 * @param enabled - The list of enabled status for all structures
 * @param binCount - Bin count for the histogram
 * @returns Array of (distance, count) pairs
 */
export const methodDistancesHistogram = (distanceMatrix: DistanceMatrix,
										 enabled: boolean[],
								   		 binCount: number): [distance: number, count: number][] => {

	// For each distance between two enabled points find the distances range
	let maxDistance = Number.NEGATIVE_INFINITY;
	const n = distanceMatrix.matrixSize();
	for(let row=0; row < n-1; ++row) {
		if(!enabled[row]) continue;
		for(let col=row+1; col < n; ++col) {
			if(!enabled[col]) continue;

			const distance = distanceMatrix.get(row, col);
			if(distance > maxDistance) maxDistance = distance;
		}
	}

	// Fill bins with distances count or zero if range too small or zero
	const bins = Array<number>(binCount).fill(0);
	const binWidth = maxDistance/binCount;
	if(binWidth > 1e-10) {

		for(let row=0; row < n-1; ++row) {
			if(!enabled[row]) continue;
			for(let col=row+1; col < n; ++col) {
				if(!enabled[col]) continue;

				const distance = distanceMatrix.get(row, col);
				let bin = Math.floor(distance/binWidth);
				if(bin === binCount) --bin;
				++bins[bin];
			}
		}
	}

	// Fill the histogram
	const distanceHistogram = Array<[distance: number, count: number]>(binCount);
	let di = 0;
	for(let i=0; i < binCount; ++i) {

		distanceHistogram[i] = [di, bins[i]];
		di += binWidth;
	}

	return distanceHistogram;
};

/**
 * Prepare the histogram of energies
 *
 * @param energies - Energies per structure
 * @param enabled - The list of enabled status for all structures
 * @param binCount - Bin count for the histogram
 * @returns Array of (energy, count) pairs
 */
export const methodEnergiesHistogram = (energies: number[],
										enabled: boolean[],
										binCount: number): [energy: number, count: number][] => {

	// Find energy range
	let minEnergy = Number.POSITIVE_INFINITY;
	let maxEnergy = Number.NEGATIVE_INFINITY;
	let idx = 0;
	for(const energy of energies) {
		if(enabled[idx]) {
			if(energy < minEnergy) minEnergy = energy;
			if(energy > maxEnergy) maxEnergy = energy;
		}
		++idx;
	}

	// Fill bins with energy count or zero if range too small or zero
	const bins = Array<number>(binCount).fill(0);
	let binWidth = (maxEnergy-minEnergy)/binCount;

	if(binWidth < 1e-7) {
		const MARGIN = 0.01;
		minEnergy *= 1-MARGIN;
		maxEnergy *= 1+MARGIN;
		binWidth = (maxEnergy-minEnergy)/binCount;
	}

	idx = 0;
	for(const energy of energies) {
		if(enabled[idx]) {
			let bin = Math.floor((energy-minEnergy)/binWidth);
			if(bin === binCount) --bin;
			++bins[bin];
		}
		++idx;
	}

	// Fill the histogram
	const energyHistogram = Array<[energy: number, count: number]>(binCount);
	let en = minEnergy;
	for(let i=0; i < binCount; ++i) {

		energyHistogram[i] = [en, bins[i]];
		en += binWidth;
	}

	return energyHistogram;
};

/**
 * Prepare the scatterplot of distance and energy difference from the minimum energy point
 *
 * @param energies - Energies per structure
 * @param enabled - The list of enabled status for all structures
 * @param distanceMatrix - The distance matrix
 * @returns Array of (distance from minimum energy point, energy from minimum) pairs
 */
export const methodEnergyDistance = (energies: number[],
									 enabled: boolean[],
									 distanceMatrix: DistanceMatrix):
									 						[distance: number, energy: number][] => {

	// Get minimum energy and index of the corresponding point
	let minEnergy = Number.POSITIVE_INFINITY;
	let minEnergyIdx = 0;
	let idx = 0;
	for(const energy of energies) {
		if(enabled[idx] && energy < minEnergy) {
			minEnergy = energy;
			minEnergyIdx = idx;
		}
		++idx;
	}

	// Compute energy differences
	const energyDistance: [distance: number, energy: number][] = [];
	idx = 0;
	for(const energy of energies) {
		if(enabled[idx]) {
			energyDistance.push([0, energy - minEnergy]);
		}
		++idx;
	}

	// Compute distances
	const len = distanceMatrix.matrixSize();
	idx = 0;
	for(let col=0; col < len; ++col) {
		if(enabled[col]) {
			const distance = distanceMatrix.get(minEnergyIdx, col);
			energyDistance[idx++][0] = distance;
		}
	}

	// Order by increasing distances
	return energyDistance.toSorted((a, b) => a[0] - b[0]);
};

/**
 * Prepare the order parameters list
 *
 * @remarks Computed from eq. 8 of J. Chem. Phys. 130, 104504 (2009)
 *
 * @param accumulator - The accumulator to access the selected structures
 * @param binWidth - Width of the bin used to compute the fingerprints
 * @returns Array of order parameter per structure
 */
export const methodOrder = (accumulator: FingerprintsAccumulator,
							binWidth: number): [step: number, order: number][]  => {

	const sectionsInfo = accumulator.getSectionsInfo();
	const countSections = sectionsInfo.count;
	const order: [step: number, order: number][] = [];

	if(countSections === 1) {

		for(const {basis, fingerprint, step} of accumulator.iterateSelectedEnabledStructures()) {

			const Vuc = getCellVolume(basis);
			const R0 = Math.cbrt(Vuc);

			// Compute the degree of order
			let op = 0;
			const len = sectionsInfo.length;
			for(let j=0; j < len; ++j) {
				op += fingerprint[j]*fingerprint[j];
			}
			order.push([step, binWidth*op/R0]);
		}
	}
	else {

		const sectionWidth = sectionsInfo.length;

		for(const {basis, fingerprint, weights, step} of
			accumulator.iterateSelectedEnabledStructures()) {

			let degreeOfOrder = 0;

			const Vuc = getCellVolume(basis);
			const R0 = Math.cbrt(Vuc);

			for(let section=0; section < countSections; ++section) {

				// Compute the degree of order for the section
				let op = 0;
				for(let k=0; k < sectionWidth; ++k) {

					const yv = fingerprint[section*sectionWidth+k];

					op += yv*yv;
				}
				degreeOfOrder += binWidth*op/R0*weights[section];
			}

			order.push([step, degreeOfOrder]);
		}
	}

	return order;
};

/**
 * Prepare the distances list from the given fingerprint
 *
 * @param distanceMatrix - The distance matrix
 * @param steps - The step numbers for each fingerprint selected
 * @param enabled - The list of enabled status for all structures
 * @param row - Index of the fingerprint from which the distance should be computed
 * @returns List of (step, distance) pairs
 */
export const methodDistances = (distanceMatrix: DistanceMatrix,
								steps: number[],
								enabled: boolean[],
								row: number): [step: number, order: number][]  => {

	const distances: [step: number, order: number][] = [];
	const size = distanceMatrix.matrixSize();
	for(let col=0; col < size; ++col) {
		if(enabled[col]) {
			distances.push([steps[col], distanceMatrix.get(row, col)]);
		}
	}
	return distances;
};
