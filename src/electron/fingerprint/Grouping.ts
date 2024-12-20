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

export interface GroupingMethodName {
	label: string;
	usingEdge: boolean;
}

export interface GroupingResults {
	countGroups: number;
	error?: string;
}

export class Grouping {

	/**
     * Return the list of methods names
     *
     * @returns The list of grouping methods for the selector on the UI
     */
    getGroupingMethodsNames(): GroupingMethodName[] {
        const out: GroupingMethodName[] = [];
        for(const method of groupingMethods) out.push({label: method.label, usingEdge: method.usingEdge});
        return out;
    }

	// TBD
	group(accumulator: FingerprintsAccumulator, distances: DistanceMatrix,
		  groupingMethod: number, groupingThreshold: number, addEdge: number): GroupingResults {

		void accumulator;
		void distances;
		console.log("GROUP", groupingMethod, groupingThreshold, addEdge);

		return {countGroups: 0};
	}
}
