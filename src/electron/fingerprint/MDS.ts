/**
* <<DESCRIPTION>>
*
* @packageDocumentation
*
* @author Mario Valle "mvalle at ikmail.com"
* @since 2025-11-17
*/
import {eigs} from "mathjs";
import type {MDSOutput} from "../modules/NativeFunctions";

/**
* Compute Multidimensional Scaling (MDS)
*
* @param distancesVector - Distances vector (upper triangular of NxN symmetrical distances matrix)
* @param pointsCount - Number of points (N), that is, the side of the distance matrix
* @param pointsEnabled - Mark which of the `pointsCount` points is enabled
* @returns Arrays of points coordinates in the 2D and 3D output space
*/
export const MDS = (distancesVector: number[],
					pointsCount: number,
					pointsEnabled: boolean[]): MDSOutput => {

	// 1. Count the number of enabled points and map indices to the enabled ones
	let enabledSide = pointsCount;
	let enabledIndex = 0;
	const mapIndex = Array<number>(pointsCount);
	for(let i = 0; i < pointsCount; i++) {
		if(pointsEnabled[i]) mapIndex[i] = enabledIndex++;
		else --enabledSide;
	}
	if(enabledSide === 0) return {points2D: [], points3D: []};

	// 2. Create the matrix of distances squared between enabled points
	const D2 = Array<number[]>(enabledSide);
	for(let i=0; i < enabledSide; ++i) D2[i] = Array<number>(enabledSide).fill(0);

	for(let row=0; row < pointsCount-1; ++row) {

		if(!pointsEnabled[row]) continue;

		const erow = mapIndex[row];

		for(let col=row+1; col < pointsCount; ++col) {

			if(!pointsEnabled[col]) continue;

			// Formula for upper triangular matrix
			// The 2nd member should stay as-is otherwise it truncates
			const idx = pointsCount*row-(row*(row+1))/2+col-row-1;

			// Map indices to the ones with disabled points removed
			const ecol = mapIndex[col];

			const v = distancesVector[idx];
			D2[erow][ecol] = D2[ecol][erow] = v*v;
		}
	}

	// 3. Compute row and total averages
	const rowMeans = D2.map((row) =>
		row.reduce((sum, value) => sum + value, 0) / enabledSide
	);
	const totalMean = rowMeans.reduce((sum, value) => sum + value, 0) / enabledSide;

	// 4. Compute double centering matrix
	const doubleCenteringMatrix = Array<number[]>(enabledSide);
	for(let row=0; row < enabledSide; ++row) {
		doubleCenteringMatrix[row] = Array<number>(enabledSide).fill(0);
	}

	for(let i = 0; i < enabledSide; i++) {
		for(let j = 0; j < enabledSide; j++) {
			doubleCenteringMatrix[i][j] = -0.5 * (D2[i][j] - rowMeans[i] - rowMeans[j] + totalMean);
		}
	}

	// 5. Compute eigenvalues and eigenvectors
	const result = eigs(doubleCenteringMatrix);
	const last = result.eigenvectors.length-1;

	// 6. Compute the final coordinates 2D and 3D
	const points2D = Array<number[]>(pointsCount);
	const points3D = Array<number[]>(pointsCount);
	for(let i = 0; i < pointsCount; i++) {
		points2D[i] = Array<number>(2).fill(0);
		points3D[i] = Array<number>(3).fill(0);
		if(!pointsEnabled[i]) continue;
		const ei = mapIndex[i];
		for(let j = 0; j < 2; j++) {

			const eigenvalue = result.eigenvectors[last-j].value as number;
			const eigenvector = result.eigenvectors[last-j].vector as number[];
			points2D[i][j] = eigenvector[ei] * Math.sqrt(Math.abs(eigenvalue));
		}
		for(let j = 0; j < 3; j++) {

			const eigenvalue = result.eigenvectors[last-j].value as number;
			const eigenvector = result.eigenvectors[last-j].vector as number[];
			points3D[i][j] = eigenvector[ei] * Math.sqrt(Math.abs(eigenvalue));
		}
	}

	// 7. Normalize coordinates in 0..1 interval
	const min2D = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max2D = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	const min3D = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max3D = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for(let i = 0; i < pointsCount; i++) {

		if(!pointsEnabled[i]) continue;
		const p2d = points2D[i];
		const p3d = points3D[i];
		for(let j=0; j < 2; ++j) {
			if(p2d[j] < min2D[j]) min2D[j] = p2d[j];
			if(p2d[j] > max2D[j]) max2D[j] = p2d[j];
		}
		for(let j=0; j < 3; ++j) {
			if(p3d[j] < min3D[j]) min3D[j] = p3d[j];
			if(p3d[j] > max3D[j]) max3D[j] = p3d[j];
		}
	}
	for(let i = 0; i < pointsCount; i++) {

		if(!pointsEnabled[i]) continue;
		for(let j=0; j < 2; ++j) {
			points2D[i][j] = (points2D[i][j] - min2D[j]) / (max2D[j] - min2D[j]);
		}
		for(let j=0; j < 3; ++j) {
			points3D[i][j] = (points3D[i][j] - min3D[j]) / (max3D[j] - min3D[j]);
		}
	}

	return {
		points2D,
		points3D
	};
};
