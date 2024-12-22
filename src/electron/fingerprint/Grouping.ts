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

	/** For each group the list of structures indices */
	private readonly groups: number[][] = [];

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

		const groups = groupingMethods[groupingMethod].method.doGrouping(accumulator,
																		distances,
																		groupingThreshold,
																		addMargin);

		for(const group of groups) {

			const idxs = [...group];
			const ids = [];
			for(const idx of idxs) ids.push(accumulator.toOriginalIndex(idx));
			this.groups.push(ids);
		}

		return {countGroups: this.groups.length};
	}
}
