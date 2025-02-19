/**
 * Group structures based on their fingerprints distance.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-20
 */
import {groupingMethods} from "./GroupingMethods";
import type {FingerprintsAccumulator, StructureReduced} from "./Accumulator";
import type {DistanceMatrix, Distances} from "./Distances";
import {generalizedConvexHull4D} from "./GeneralizedConvexHull";

/** List of methods names for the UI */
export interface GroupingMethodName {
	label: string;
	usingMargin: boolean;
}

interface GroupingResults {
	countGroups: number;
	error?: string;
}

export class Grouping {

	private readonly structureGroup: number[] = [];
	private countGroups = 0;

	/**
     * Return the list of methods names
     *
     * @returns The list of grouping methods for the selector on the UI
     */
    getGroupingMethodsNames(): GroupingMethodName[] {
        const out: GroupingMethodName[] = [];
        for(const method of groupingMethods) out.push({label: method.label, usingMargin: method.usingMargin});
        return out;
    }

	/**
	 * Group the structures based on their fingerprints distance
	 *
	 * @param accumulator - The accumulated structures
	 * @param distances - The pair distance matrix
	 * @param groupingMethod - Method to be used to do the grouping
	 * @param groupingThreshold - Threshold on distances to consider structures in the same group
	 * @param addedMargin - Connections to add to minimum one to set structures as linked.
	 * 						(1+addedMargin) is called "K".
	 * @returns Count of groups found
	 */
	group(accumulator: FingerprintsAccumulator, distances: DistanceMatrix,
		  groupingMethod: number, groupingThreshold: number, addedMargin: number): GroupingResults {

		// How many structures selected
		this.structureGroup.length = accumulator.selectedSize();

		// For each group the list of structures indices
		const groups = groupingMethods[groupingMethod].method
							.doGrouping(
								this.structureGroup.length,
								distances,
								groupingThreshold,
								addedMargin
							);

		let groupCount = 0;
		for(const group of groups) {

			for(const idx of group) this.structureGroup[idx] = groupCount;
			++groupCount;
		}

		this.countGroups = groupCount;

		return {countGroups: groupCount};
	}

	/**
	 * Get group for structures
	 *
	 * @returns The group for each structure list
	 */
	getGroups(): number[] {

		return this.structureGroup;
	}

	/**
	 * Get count of groups
	 *
	 * @returns Count of groups found
	 */
	getCountGroups(): number {

		return this.countGroups;
	}

	/**
	 * Compute the silhouette coefficient for each point
	 *
	 * @param distances - The pair distance matrix
	 * @returns The silhouette coefficient value for each structure (value from -1 to 1)
	 */
	computeSilhouetteCoefficients(distances: DistanceMatrix, enabled: boolean[]): number[] {

		// Number of points
		const countStructures = this.structureGroup.length;

		// Extract the size of each group
		const groupSizes = Array(this.countGroups).fill(0) as number[];
		for(const group of this.structureGroup) ++groupSizes[group];

		// The final silhouette coefficient
		const silhouette: number[] = [];

		for(let i=0; i < countStructures; ++i) {

			if(!enabled[i]) continue;

			// Get the point group
			const gi = this.structureGroup[i];

			// If its group size is one, do nothing, the silhouette is zero
			if(groupSizes[gi] === 1) {
				silhouette[i] = 0;
				continue;
			}

			// Intracluster mean distance
			let distanceSum = 0;
			for(let j=0; j < countStructures; ++j) {

				const gj = this.structureGroup[j];
				if(gj !== gi || i === j) continue;

				distanceSum += distances.get(i, j);
			}

			const intra = distanceSum/(groupSizes[gi]-1);

			// Extra-cluster min distance
			const distancesByGroup = Array(this.countGroups).fill(0) as number[];

			// For all other groups
			for(let gj=0; gj < this.countGroups; ++gj) {

				if(gj === gi) continue;

				for(let j=0; j < countStructures; ++j) {

					if(this.structureGroup[j] === gi) continue;
					distancesByGroup[gj] += distances.get(i, j);
				}

				distancesByGroup[gj] /= groupSizes[gj];
			}

			// Find minimal distance
			let extra = Number.POSITIVE_INFINITY;
			for(let gj=0; gj < this.countGroups; ++gj) {

				if(gj === gi) continue;
				if(distancesByGroup[gj] < extra) extra = distancesByGroup[gj];
			}

			// The final silhouette coefficient
			silhouette.push((extra-intra)/Math.max(intra, extra));
		}

		return silhouette;
	}

	/**
	 * Puts enabled true to the lowest energy structure per group
	 *
	 * @param accumulator - The accumulated structures
	 * @param distances - The pair distance object
	 */
	private reduceToOnePerGroup(accumulator: FingerprintsAccumulator,
								distances: Distances): void {

		// Start with nothing enabled
		accumulator.setEnableStatus(false);

		// Number of structures
		const countStructures = this.structureGroup.length;

		// Sanity check
		if(countStructures === 0 || this.countGroups === 0) return;

		const distanceMatrix = distances.getDistanceMatrix();

		// Extract the size of each group
		const groupSizes = Array(this.countGroups).fill(0) as number[];
		for(const group of this.structureGroup) ++groupSizes[group];

		// Make an index of the structures
		const structures = Array(countStructures) as StructureReduced[];
		let idx = 0;
		const hasEnergies = accumulator.accumulatedHaveEnergies();
		for(const structure of accumulator.iterateSelectedStructures()) {
			structures[idx++] = structure;
		}

		// For each group
		for(let gi=0; gi < this.countGroups; ++gi) {

			// If its group size is one, enable the only member
			if(groupSizes[gi] === 1) {

				for(let j=0; j < countStructures; ++j) {
					const gj = this.structureGroup[j];
					if(gj === gi) {
						structures[j].enabled = true;
						break;
					}
				}
			}
			// Else if there are energies
			else if(hasEnergies) {

				// Find minimum energy
				let minEnergy = Number.POSITIVE_INFINITY;
				let minEnergyIdx = 0;
				for(let j=0; j < countStructures; ++j) {

					const gj = this.structureGroup[j];
					if(gj === gi && structures[j].energy! < minEnergy) {
						minEnergy = structures[j].energy!;
						minEnergyIdx = j;
					}
				}
				structures[minEnergyIdx].enabled = true;
			}
			// Else finds the most central point using the sum of distances (geometric median)
			else {

				let medianDistance = Number.POSITIVE_INFINITY;
				let medianDistanceIdx = 0;
				for(let j=0; j < countStructures; ++j) {

					const gj = this.structureGroup[j];
					if(gj !== gi) continue;
					let totalDistance = 0;
					for(let k=0; k < countStructures; ++k) {
						const gk = this.structureGroup[k];
						if(gk !== gi || k === j) continue;
						totalDistance += distanceMatrix.get(j, k);
					}
					if(totalDistance < medianDistance) {
						medianDistance = totalDistance;
						medianDistanceIdx = j;
					}
				}
				structures[medianDistanceIdx].enabled = true;
			}
		}
	}


	/**
	 * Puts enabled to a selected subset of structures based on convex hull results
	 *
	 * @param reductionType - Select the kind of reduction method:
	 * - only: select points with the generalized convex hull 4D
	 * - hull: combine the generalized convex hull 4D with the group method
	 * @param accumulator - The accumulated structures
	 * @param distances - The pair distance object
	 */
	private reduceUsingConvexHull(reductionType: string,
						  		  accumulator: FingerprintsAccumulator,
						  		  distances: Distances): void {

		// Start with nothing enabled
		accumulator.setEnableStatus(false);

		// Number of structures
		const countStructures = this.structureGroup.length;

		// Sanity check
		if(countStructures === 0 ||
		   this.countGroups === 0 ||
		   !accumulator.accumulatedHaveEnergies()) return;

		// Make an index of the structures and collect energies
		const structures = Array(countStructures) as StructureReduced[];
		let idx = 0;
		const energies: number[] = [];
		for(const structure of accumulator.iterateSelectedStructures()) {
			structures[idx++] = structure;
			energies.push(structure.energy!);
		}

		// Compute the generalized convex hull
		const distanceMatrix = distances.getDistanceMatrix();
		const countPoints = distanceMatrix.matrixSize();
		const convexHullIndices = generalizedConvexHull4D(distanceMatrix, countPoints, energies);

		if(reductionType === "only") {
			for(const idx of convexHullIndices) {
				structures[idx].enabled = true;
			}
			return;
		}

		let pi = 0;
		for(const i of convexHullIndices) {
			if(i >= 0) {
				const gi = this.structureGroup[i];

				let minEnergy = structures[i].energy!;
				let minEnergyIdx = i;
				convexHullIndices[pi] = -1;

				let pj = 0;
				for(const j of convexHullIndices) {
					if(j >= 0) {
						const gj = this.structureGroup[j];
						if(gj === gi) {

							if(structures[j].energy! < minEnergy) {
								minEnergy = structures[j].energy!;
								minEnergyIdx = j;
							}
							convexHullIndices[pj] = -1;
						}
					}
					++pj;
				}
				structures[minEnergyIdx].enabled = true;
			}
			++pi;
		}
	}

	/**
	 * Puts enabled true to a selected subset of structures
	 *
	 * @param reductionType - Select the kind of reduction method:
	 * - none: no reduction done
	 * - group: select one element per group, the minimal energy or the centroid
	 * - only: select points with the generalized convex hull 4D
	 * - hull: combine the generalized convex hull 4D with the group method
	 * @param accumulator - The accumulated structures
	 * @param distances - The pair distance object
	 */
	reducePoints(reductionType: string,
				 accumulator: FingerprintsAccumulator,
				 distances: Distances): void {

		switch(reductionType) {
			case "none":
				accumulator.setEnableStatus(true);
				break;

			case "group":
				this.reduceToOnePerGroup(accumulator, distances);
				break;

			case "hull":
			case "only":
				this.reduceUsingConvexHull(reductionType, accumulator, distances);
				break;
		}
	}
}
