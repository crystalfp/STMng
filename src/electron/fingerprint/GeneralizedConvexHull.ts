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

/**
 * Compute the 3D convex hull and take the lower half points
 *
 * @param mappedPoints - Points projected in 2D
 * @param energies - Corresponding energies
 * @returns List of indices of the selected points
 */
export const generalizedConvexHull3D = (mappedPoints: number[][], energies: number[]): number[] => {

	// Prepare the 3D points
	const generalizedPoints = Array(mappedPoints.length) as number[][];
	for(let i=0; i < mappedPoints.length; ++i) {
		generalizedPoints[i] = [
			mappedPoints[i][0],
			mappedPoints[i][1],
			energies[i]
		];
	}
	const hull = quickHull(generalizedPoints);

	const vertices = new Set<number>();
	for(const facet of hull) {
		if(facet.plane[2] <= 0) {
			for(const vv of facet.verts) vertices.add(vv);
		}
	}

	return [...vertices];
};

/**
 * Compute the 4D convex hull and take the lower half points
 *
 * @param distanceVector - Distances between points as vector
 * @param countPoints - How many points present
 * @param energies - Corresponding energies
 * @returns List of indices of the selected points
 */
export const generalizedConvexHull4D = (distanceVector: number[],
										countPoints: number,
										energies: number[]): number[] => {

	const mappedPoints = MDS(distanceVector, countPoints, 3);
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
