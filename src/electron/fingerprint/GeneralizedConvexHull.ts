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
 * Distance between two clusters
 *
 * @param idxi - Indices of the points in the first cluster
 * @param idxj - Indices of the points in the second cluster
 * @param distances - Distance matrix
 * @returns Distance between the two clusters
 */
const clusterDistance = (idxi: number[], idxj: number[], distances: DistanceMatrix): number => {

	const leni = idxi.length;
	const lenj = idxj.length;

	if(leni === 1 && lenj === 1) {
		return distances.get(idxi[0], idxj[0]);
	}

	let distance = Number.POSITIVE_INFINITY;

	for(let i=0; i < leni; ++i) {
		for(let j=0; j < lenj; ++j) {
			const dd = distances.get(idxi[i], idxj[j]);
			if(dd < distance) distance = dd;
		}
	}

	return distance;
};

/**
 * Remove similar point using hierarchical grouping (single linkage)
 *
 * @param indices - Indices of the points on the generalized convex hull
 * @param distanceMatrix - The distance matrix for all points
 * @param threshold - Threshold to consider two points as similar
 * @param energies - The energies for all points
 * @returns The minimal energy point inside the various similarity groups
 */
export const removeSimilarPoints = (indices: number[],
							 		distanceMatrix: DistanceMatrix,
							 		threshold: number,
							 		energies: number[]): number[] => {

	// Initialize root (to point to all)
	const root: number[][] = [];
	for(const index of indices) root.push([index]);

	// Iterate till the distance becomes greater than the given threshold
	while(root.length > 1) {

		let mini: number;
		let minj: number;
		let minDistance = Number.POSITIVE_INFINITY;
		const len = root.length;
		for(let ni=0; ni < len-1; ++ni) {
			for(let nj=ni+1; nj < len; ++nj) {
				const distance = clusterDistance(root[ni], root[nj], distanceMatrix);
				if(distance < minDistance) {
					minDistance = distance;
					mini = ni;
					minj = nj;
				}
			}
		}

		// Exit if the threshold has been reached
		if(minDistance > threshold) break;

		// Update the group list. Merge node j at the end of node i
		for(const element of root[minj!]) root[mini!].push(element);

		// Remove merged node
		root.splice(minj!, 1);
	}

	// For each group of similar points return the minimum energy point
	const filteredIndices: number[] = [];
	for(const group of root) {
		if(group.length === 1) filteredIndices.push(group[0]);
		else {
			let minEnergy = Number.POSITIVE_INFINITY;
			let minEnergyIdx = 0;
			for(const entry of group) {
				if(energies[entry] < minEnergy) {
					minEnergy = energies[entry];
					minEnergyIdx = entry;
				}
			}
			filteredIndices.push(minEnergyIdx);
		}
	}
	return filteredIndices;
};

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
