/**
 * The analysis methods that produce data for the Fingerprinting chart window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-28
 */
import {getCellVolume} from "./Helpers";
import type {DistanceMatrix} from "./Distances";
import type {FingerprintsAccumulator} from "./Accumulator";

/**
 * Prepare the histogram of distances
 *
 * @param distances - Distance vector
 * @param binCount - Bin count for the histogram
 * @returns Array of (distance, count) pairs
 */
export const methodDistancesHistogram = (distances: number[],
								   		 binCount: number): [distance: number, count: number][] => {

	// Find distances range
	let minDistance = Number.POSITIVE_INFINITY;
	let maxDistance = Number.NEGATIVE_INFINITY;
	for(const distance of distances) {
		if(distance < minDistance) minDistance = distance;
		if(distance > maxDistance) maxDistance = distance;
	}

	// Fill bins with distances count or zero if range too small or zero
	const bins = Array(binCount).fill(0) as number[];
	const binWidth = (maxDistance-minDistance)/binCount;
	if(binWidth > 1e-10) {

		for(const distance of distances) {
			let idx = Math.floor((distance-minDistance)/binWidth);
			if(idx === binCount) --idx;
			++bins[idx];
		}
	}

	// Fill the histogram
	const distanceHistogram = Array(binCount) as [distance: number, count: number][];
	let di = minDistance;
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
 * @param binCount - Bin count for the histogram
 * @returns Array of (energy, count) pairs
 */
export const methodEnergiesHistogram = (energies: number[],
										binCount: number): [energy: number, count: number][] => {

	// Find energy range
	let minEnergy = Number.POSITIVE_INFINITY;
	let maxEnergy = Number.NEGATIVE_INFINITY;
	for(const energy of energies) {
		if(energy < minEnergy) minEnergy = energy;
		if(energy > maxEnergy) maxEnergy = energy;
	}

	// Fill bins with energy count or zero if range too small or zero
	const bins = Array(binCount).fill(0) as number[];
	const binWidth = (maxEnergy-minEnergy)/binCount;
	if(binWidth > 1e-10) {

		for(const energy of energies) {
			let idx = Math.floor((energy-minEnergy)/binWidth);
			if(idx === binCount) --idx;
			++bins[idx];
		}
	}

	// Fill the histogram
	const energyHistogram = Array(binCount) as [energy: number, count: number][];
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
 * @param distanceMatrix - The distance matrix
 * @returns Array of (distance from minimum energy point, energy from minimum) pairs
 */
export const methodEnergyDistance = (energies: number[],
									 distanceMatrix: DistanceMatrix): [distance: number, energy: number][] => {

	// Get minimum energy and index of the corresponding point
	let minEnergy = Number.POSITIVE_INFINITY;
	let minEnergyIdx = 0;
	let idx = 0;
	for(const energy of energies) {

		if(energy < minEnergy) {
			minEnergy = energy;
			minEnergyIdx = idx;
		}
		++idx;
	}

	// Compute energy differences
	const energyDistance: [distance: number, energy: number][] = [];
	for(const energy of energies) {
		energyDistance.push([0, energy - minEnergy]);
	}

	// Compute distances
	const len = distanceMatrix.matrixSize();
	for(let col=0; col < len; ++col) {
		const distance = distanceMatrix.get(minEnergyIdx, col);
		energyDistance[col][0] = distance;
	}

	// Order by increasing distances
	energyDistance.sort((a, b) => a[0] - b[0]);

	return energyDistance;
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
							binWidth: number): [id: number, order: number][]  => {

	const sectionsInfo = accumulator.getSectionsInfo();
	const countSections = sectionsInfo.count;
	const order: [id: number, order: number][] = [];

	if(countSections === 1) {

		for(const structure of accumulator.iterateSelectedStructures()) {

			const {basis, fingerprint, id} = structure;

			const Vuc = getCellVolume(basis);
			const R0 = Math.cbrt(Vuc);

			// Compute the degree of order
			let op = 0;
			for(let j=0; j < sectionsInfo.length; ++j) op += fingerprint[j]*fingerprint[j];
			order.push([id, binWidth*op/R0]);
		}
	}
	else {

		const sectionWidth = sectionsInfo.length;

		for(const structure of accumulator.iterateSelectedStructures()) {

			const {basis, fingerprint, weights, id} = structure;

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

			order.push([id, degreeOfOrder]);
		}
	}

	return order;
};

/**
 * Prepare the distances list from the given fingerprint
 *
 * @param distanceMatrix - The distance matrix
 * @param steps - The step numbers for each fingerprint selected
 * @param row - Index of the fingerprint from which the distance should be computed
 * @returns List of (step, distance) pairs
 */
export const methodDistances = (distanceMatrix: DistanceMatrix,
								steps: number[],
								row: number): [id: number, order: number][]  => {

	const distances: [id: number, order: number][] = [];
	for(let col=0; col < distanceMatrix.matrixSize(); ++col) {
		distances.push([steps[col], distanceMatrix.get(row, col)]);
	}
	return distances;
};
