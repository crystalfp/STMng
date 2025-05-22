/**
 * Compute eigenvalues and eigenvectors of a 3x3 symmetric matrix
 * Uses the power iteration and deflation method
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-05-13
 */
export type Matrix = number[][];
type Vector = number[];
interface EigenResult {
    eigenvalues: number[];
    eigenvectors: Matrix;
}

/**
 * Normalize a vector to unit length
 *
 * @param v - Vector to normalize
 * @returns Normalized vector
 */
const normalize = (v: Vector): Vector => {
    const magnitude = Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
    return v.map((value) => value / magnitude);
};

/**
 * Multiply a matrix by a vector
 *
 * @param matrix - Matrix to be multiplied
 * @param vector - Vector multiplier
 * @returns Result of matrix x vector
 */
const matrixVectorMultiply = (matrix: Matrix, vector: Vector): Vector => {

    const result: Vector = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for(let i = 0; i < matrix.length; i++) {
        let sum = 0;
        for(let j = 0; j < vector.length; j++) {
            sum += matrix[i][j] * vector[j];
        }
        result.push(sum);
    }
    return result;
};

/**
 * Calculate the dot product of two vectors
 *
 * @param v1 - First vector
 * @param v2 - Second vector
 * @returns Dot product of the two vectors
 */
const dotProduct = (v1: Vector, v2: Vector): number => {
    return v1.reduce((sum, value, i) => sum + value * v2[i], 0);
};

/**
 * Outer product of two vectors (returns a matrix)
 *
 * @param v1 - First vector
 * @param v2 - Second vector
 * @returns Outer product as matrix
 */
const outerProduct = (v1: Vector, v2: Vector): Matrix => {
    return v1.map((value1) => v2.map((value2) => value1 * value2));
};

/**
 * Matrix subtraction
 *
 * @param m1 - First matrix
 * @param m2 - Second matrix
 * @returns Difference m1 - m2
 */
const matrixSubtract = (m1: Matrix, m2: Matrix): Matrix => {
    return m1.map((row, i) => row.map((value, j) => value - m2[i][j]));
};

/**
 * Matrix scalar multiplication
 *
 * @param matrix - Matrix to be multiplied
 * @param scalar - Multiplier
 * @returns Matrix with all elements multiplied by the scalar
 */
const matrixScalarMultiply = (matrix: Matrix, scalar: number): Matrix => {
    return matrix.map((row) => row.map((value) => value * scalar));
};

/**
 * Check if a matrix is symmetric
 *
 * @param matrix - Matrix to be checked
 * @returns If the matrix is symmetric
 */
const isSymmetric = (matrix: Matrix): boolean => {
    const n = matrix.length;
    for(let i = 0; i < n; i++) {
        for(let j = 0; j < i; j++) {
            if(Math.abs(matrix[i][j] - matrix[j][i]) > 1e-10) {
                return false;
            }
        }
    }
    return true;
};

/**
 * Power iteration method to find the dominant eigenvalue and eigenvector
 *
 * @param matrix - Matrix to be decomposed
 * @param iterations - Number of iterations
 * @param tolerance - Terminating tolerance
 * @returns Dominant eigenvalue and eigenvector
 */
const powerIteration = (matrix: Matrix,
                        iterations = 200,
                        tolerance = 1e-10): {eigenvalue: number; eigenvector: Vector} => {

    const n = matrix.length;

    // Start with a random vector
    // eslint-disable-next-line sonarjs/pseudo-random
    let eigenvector = Array(n).fill(0).map(() => Math.random());
    eigenvector = normalize(eigenvector);

    let eigenvalue = 0;
    let previousEigenvalue = 0;

    for(let iter = 0; iter < iterations; iter++) {

        // Multiply matrix by the current approximation
        const product = matrixVectorMultiply(matrix, eigenvector);

        // Find the new approximation for the eigenvector
        eigenvector = normalize(product);

        // Calculate the eigenvalue using the Rayleigh quotient
        const Av = matrixVectorMultiply(matrix, eigenvector);
        eigenvalue = dotProduct(eigenvector, Av);

        // Check for convergence
        if(Math.abs(eigenvalue - previousEigenvalue) < tolerance) break;

        previousEigenvalue = eigenvalue;
    }

    return {eigenvalue, eigenvector};
};

/**
 * Compute all eigenvalues and eigenvectors of a symmetric matrix
 * using power iteration and deflation
 *
 * @param matrix - Matrix to be decomposed
 * @returns All eigenvalues and eigenvectors
 */
export const computeEigen = (matrix: Matrix): EigenResult => {

    if(!isSymmetric(matrix)) throw Error("Matrix must be symmetric");

    const n = matrix.length;
    const eigenvalues: number[] = [];
    const eigenvectors: Matrix = [];

    // Make a copy of the original matrix
    let remainingMatrix = matrix.map((row) => [...row]);

    // Find eigenvalues and eigenvectors one by one
    for(let i = 0; i < n - 1; i++) {

        // Find the dominant eigenvalue and eigenvector
        const {eigenvalue, eigenvector} = powerIteration(remainingMatrix);

        // Store results
        eigenvalues.push(eigenvalue);
        eigenvectors.push(eigenvector);

        // Deflate the matrix by removing the contribution of the found eigenvalue/eigenvector
        const deflation = matrixScalarMultiply(outerProduct(eigenvector, eigenvector), eigenvalue);
        remainingMatrix = matrixSubtract(remainingMatrix, deflation);
    }

    // For the last eigenvalue/eigenvector
    // We can find it directly knowing that the trace equals the sum of eigenvalues
    let trace = 0;
    for(let i = 0; i < n; i++) trace += matrix[i][i];
    const lastEigenvalue = trace - eigenvalues.reduce((sum, value) => sum + value, 0);
    eigenvalues.push(lastEigenvalue);

    // Find the last eigenvector using the original matrix and the last eigenvalue
    // We'll solve (A - λI)v = 0
    // For simplicity, we'll use power iteration on the remaining matrix
    const lastEigenvector = powerIteration(remainingMatrix).eigenvector;
    eigenvectors.push(lastEigenvector);

    return {eigenvalues, eigenvectors};
};
/*

verify(matrix, eigenvalues, eigenvectors);


const verify = (matrix: Matrix, eigenvalues: number[], eigenvectors: Matrix): void => {

    console.log("Matrix:");
    for(const row of matrix) console.log(JSON.stringify(row));

    console.log("\nChecking if matrix is symmetric:", isSymmetric(matrix));

    console.log("\nEigenvalues:");
    console.log(eigenvalues);

    console.log("\nEigenvectors (columns):");
    for(const vec of eigenvectors) console.log(JSON.stringify(vec));

    // Verification: For each eigenvector v and corresponding eigenvalue λ
    // A*v should approximately equal λ*v
    console.log("\nVerification:");
    for(let i = 0; i < eigenvalues.length; i++) {
        const eigenvalue = eigenvalues[i];
        const eigenvector = eigenvectors[i];

        console.log(`Eigenvalue ${i+1}: ${eigenvalue.toFixed(6)}`);

        const Av = matrixVectorMultiply(matrix, eigenvector);
        const lambdaV = eigenvector.map((v) => v * eigenvalue);

        console.log("A*v     :", JSON.stringify(Av.map((v) => v.toFixed(6))));
        console.log("lambda*v:", JSON.stringify(lambdaV.map((v) => v.toFixed(6))));
        console.log("---");
    }
};
*/
