/**
 * Compute the convex hull in the space of mapped points and energies
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-23
 */
import {quickHull} from "@derschmale/tympanum";
import type {DistanceMatrix} from "./Distances";
import {MDS} from "../modules/NativeFunctions";

/**
 * Compute the 4D convex hull and take the lower half points
 *
 * @param distanceMatrix - Distances between points
 * @param countPoints - How many points present
 * @param enabled - If the point is enabled or not
 * @param energies - Corresponding energies
 * @returns List of indices of the selected points
 */
export const generalizedConvexHull4D = (distanceMatrix: DistanceMatrix,
										countPoints: number,
										enabled: boolean[],
										energies: number[]): number[] => {

	// Project points to 3D
	const mappedPoints = MDS(distanceMatrix.toVector(), countPoints, enabled, 3);

	// Prepare 4D points
	const generalizedPoints: number[][] = [];
	let idx = 0;
	for(const mappedPoint of mappedPoints) {
		if(enabled[idx]) {
			generalizedPoints.push([
				mappedPoint[0],
				mappedPoint[1],
				mappedPoint[2],
				energies[idx]
			]);
		}
		++idx;
	}

	// Create the 4D convex hull
	const hull = quickHull(generalizedPoints);

	// Extract the lower side vertices
	const vertices = new Set<number>();
	for(const facet of hull) {
		if(facet.plane[3] <= 0) {
			for(const vv of facet.verts) vertices.add(vv);
		}
	}

	return [...vertices];
};
