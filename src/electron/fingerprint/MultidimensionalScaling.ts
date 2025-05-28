/**
 * Classical Multidimensional Scaling (MDS)
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-28
 */
import {eigs} from "mathjs";

/**
 * Transform a distances vector into a squared matrix of distances
 *
 * @param vector - Upper triangular of side x side matrix
 * @param side - Size of the original square symmetrical matrix
 * @returns Square matrix of squared input values
 */
const vector2squaredMatrix = (vector: number[], side: number): number[][] => {

	const D2 = Array<number[]>(side);
	for(let i=0; i < side; ++i) D2[i] = Array<number>(side).fill(0);

	let pos = 0;
	for(let i=0; i < side-1; ++i) {

		for(let j=i+1; j < side; ++j) {

			const v = vector[pos++];
			D2[i][j] = D2[j][i] = v*v;
		}
	}

	return D2;
};

/**
 * Compute Multidimensional Scaling (MDS)
 *
 * @param distancesVector - Distances vector (upper triangular of NxN symmetrical distance matrix)
 * @param pointsCount - Number of points (N), that is, the side of the distance matrix
 * @param dimensions - Dimension of the output space (default: 2)
 * @returns Array of points coordinates in the output space (of dimension `dimensions`)
 */
export const MDS = (distancesVector: number[], pointsCount: number, dimensions = 2): number[][] => {

    // 1. Create the matrix of distances squared
	const D2 = vector2squaredMatrix(distancesVector, pointsCount);

	// 2. Compute row and total averages
    const rowMeans = D2.map((row) =>
        row.reduce((sum, value) => sum + value, 0) / pointsCount
    );
    const totalMean = rowMeans.reduce((sum, value) => sum + value, 0) / pointsCount;

    // 3. Compute double centering matrix
    const doubleCenteringMatrix = Array<number[]>(pointsCount);
    for(let row=0; row < pointsCount; ++row) {
        doubleCenteringMatrix[row] = Array<number>(pointsCount).fill(0);
    }

    for(let i = 0; i < pointsCount; i++) {
        for(let j = 0; j < pointsCount; j++) {
            doubleCenteringMatrix[i][j] = -0.5 * (D2[i][j] - rowMeans[i] - rowMeans[j] + totalMean);
        }
    }

    // 4. Compute eigenvalues and eigenvectors using the power method
    const result = eigs(doubleCenteringMatrix);
    const last = result.eigenvectors.length-1;

    // 5. Compute the final coordinates
    const coordinates = Array<number[]>(pointsCount);
    for(let i = 0; i < pointsCount; i++) {
        coordinates[i] = Array<number>(dimensions).fill(0);
        for(let j = 0; j < dimensions; j++) {

            // Use only positive eigenvalues
            // if(eigenvalues[j] > 0) {
            //     coordinates[i][j] = eigenvectors[j][i] * Math.sqrt(eigenvalues[j]);
            // }
            const eigenvalue = result.eigenvectors[last-j].value as number;
            const eigenvector = result.eigenvectors[last-j].vector as number[];
            coordinates[i][j] = eigenvector[i] * Math.sqrt(Math.abs(eigenvalue));
        }
    }

    return coordinates;
};
