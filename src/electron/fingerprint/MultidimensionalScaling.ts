/**
 * Classical Multidimensional Scaling (MDS)
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-28
 */

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
    const {eigenvalues, eigenvectors} = powerIteration(doubleCenteringMatrix, dimensions);

    // 5. Compute the final coordinates
    const coordinates = Array<number[]>(pointsCount);
    for(let i = 0; i < pointsCount; i++) {
        coordinates[i] = Array<number>(dimensions).fill(0);
        for(let j = 0; j < dimensions; j++) {

            // Use only positive eigenvalues
            // if(eigenvalues[j] > 0) {
            //     coordinates[i][j] = eigenvectors[j][i] * Math.sqrt(eigenvalues[j]);
            // }
            coordinates[i][j] = eigenvectors[j][i] * Math.sqrt(Math.abs(eigenvalues[j]));
        }
    }

    return coordinates;
};

/**
 * Compute first k eigenvalues and eigenvectors using the power method
 *
 * @param matrix - Matrix to be decomposed
 * @param k - Number of eigenvalues and eigenvectors to retain
 * @returns Eigenvalues vector and eigenvectors matrix
 */
const powerIteration = (matrix: number[][],
                        k: number): {eigenvalues: number[]; eigenvectors: number[][]} => {

    const n = matrix.length;
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    const currentMatrix = matrix.map((row) => [...row]);

    for(let i = 0; i < k; i++) {

        // Create a random vector
        // eslint-disable-next-line sonarjs/pseudo-random
        let vector = Array<number>(n).fill(0).map(() => Math.random() - 0.5);

        // Normalize the vector
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        vector = vector.map((v) => v / norm);

        // Iterate to convergence
        let lastEigenvalue = 0;
        for(let iter = 0; iter < 100; iter++) {

            // Update the test vector
            const updatedVector = multiplyMatrixVector(currentMatrix, vector);

            // Normalize the vector
            const updatedNorm = Math.sqrt(updatedVector.reduce((sum, value) => sum + value * value, 0));
            vector = updatedVector.map((v) => v / updatedNorm);

            // Compute eigenvalue using the Rayleigh quotient
            const oneEigenvalue = dotProduct(multiplyMatrixVector(currentMatrix, vector), vector);

            // Check convergence
            if(Math.abs(oneEigenvalue - lastEigenvalue) < 1e-10) break;
            lastEigenvalue = oneEigenvalue;
        }

        // Compute the final eigenvalue
        const eigenvalue = dotProduct(multiplyMatrixVector(currentMatrix, vector), vector);

        eigenvalues.push(eigenvalue);
        eigenvectors.push(vector);

        // Deflate: remove the contribution of the found eigenvalue/eigenvector
        for(let r = 0; r < n; r++) {
            for(let c = 0; c < n; c++) {
                currentMatrix[r][c] -= eigenvalue * vector[r] * vector[c];
            }
        }
    }

    return {eigenvalues, eigenvectors};
};

/**
 * Multiply vector by a matrix
 *
 * @param matrix - Matrix that multiply the vector
 * @param vector - Vector to be multiplied
 * @returns Result of the multiplication
 */
const multiplyMatrixVector = (matrix: number[][], vector: number[]): number[] => {

    const n = matrix.length;
    const result = Array<number>(n).fill(0);

    for(let i = 0; i < n; i++) {
        for(let j = 0; j < n; j++) {
            result[i] += matrix[i][j] * vector[j];
        }
    }

    return result;
};

/**
 * Compute dot product
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product of the two vectors
 */
const dotProduct = (a: number[], b: number[]): number => a.reduce((sum, value, i) => sum + value * b[i], 0);
