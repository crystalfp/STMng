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
	 * @param addMargin - Connections to add to minimum one to set structures as linked. Was called "K"
	 * @returns Count of groups found
	 */
	group(accumulator: FingerprintsAccumulator, distances: DistanceMatrix,
		  groupingMethod: number, groupingThreshold: number, addMargin: number): GroupingResults {

		// For each group the list of structures indices
		const groups = groupingMethods[groupingMethod].method.doGrouping(accumulator,
																		distances,
																		groupingThreshold,
																		addMargin);

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
	 * Get group for structure
	 *
	 * @returns The list of group for each structure
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
}
