/**
 * Compute the convex hull in the space of mapped points and energies
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-23
 */
import {quickHull} from "@derschmale/tympanum";
import {MDS} from "./MultidimensionalScaling";
import type {DistanceMatrix} from "./Distances";

/**
 * Compute the 4D convex hull and take the lower half points
 *
 * @param distanceMatrix - Distances between points
 * @param countPoints - How many points present
 * @param energies - Corresponding energies
 * @returns List of indices of the selected points
 */
export const generalizedConvexHull4D = (distanceMatrix: DistanceMatrix,
										countPoints: number,
										energies: number[]): number[] => {

	const mappedPoints = MDS(distanceMatrix.toVector(), countPoints, 3);
	const generalizedPoints = Array(mappedPoints.length) as number[][];
	for(let i=0; i < mappedPoints.length; ++i) {
		generalizedPoints[i] = [
			mappedPoints[i][0],
			mappedPoints[i][1],
			mappedPoints[i][2],
			energies[i]
		];
	}

	const hull = quickHull(generalizedPoints);

	const vertices = new Set<number>();
	for(const facet of hull) {
		if(facet.plane[3] <= 0) {
			for(const vv of facet.verts) vertices.add(vv);
		}
	}

	return [...vertices];
};
