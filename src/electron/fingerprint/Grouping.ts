/**
 * Group structures based on their fingerprints distance.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-20
 */
import {groupingMethods} from "./GroupingMethods";
import type {FingerprintsAccumulator} from "./Accumulator";
import type {DistanceMatrix} from "./Distances";

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

		// For each group the list of structures indices
		const groups = groupingMethods[groupingMethod].method.doGrouping(accumulator,
																		distances,
																		groupingThreshold,
																		addedMargin);

		this.structureGroup.length = accumulator.selectedSize();
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
	computeSilhouetteCoefficients(distances: DistanceMatrix): number[] {

		// Number of points
		const countStructures = this.structureGroup.length;

		// Extract the size of each group
		const groupSizes = Array(this.countGroups).fill(0) as number[];
		for(let i=0; i < countStructures; ++i) {
			const group = this.structureGroup[i];
			++groupSizes[group];
		}

		// Intracluster mean distance
		const a = Array(countStructures).fill(0) as number[];
		for(let i=0; i < countStructures; ++i) {

			// Get the point group
			const gi = this.structureGroup[i];

			// If its group size is one, do nothing
			if(groupSizes[gi] === 1) continue;

			let distanceSum = 0;
			for(let j=0; j < countStructures; ++j) {

				const gj = this.structureGroup[j];
				if(gj !== gi || i === j) continue;

				distanceSum += distances.get(i, j);
			}

			a[i] = distanceSum/(groupSizes[gi]-1);
		}

		// Extra-cluster min distance
		const b = Array(countStructures).fill(0) as number[];
		for(let i=0; i < countStructures; ++i) {

			// Get the point group
			const gi = this.structureGroup[i];

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
			let minDistance = Number.POSITIVE_INFINITY;
			for(let gj=0; gj < this.countGroups; ++gj) {

				if(gj === gi) continue;
				if(distancesByGroup[gj] < minDistance) minDistance = distancesByGroup[gj];
			}
			b[i] = minDistance;
		}

		// The final silhouette coefficient
		const silhouette = Array(countStructures).fill(0) as number[];
		for(let i=0; i < countStructures; ++i) {

			// Get the point group
			const gi = this.structureGroup[i];
			silhouette[i] = groupSizes[gi] === 1 ? 0 : (b[i]-a[i])/Math.max(a[i], b[i]);
		}

		return silhouette;
	}
}
