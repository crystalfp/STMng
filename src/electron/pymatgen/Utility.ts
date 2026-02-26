/**
 * Utility routines for the translated Pymatgen routines.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
import {inv, multiply} from "mathjs";

/**
 * Create zero matrix
 *
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @returns Matrix filled with zero
 */
export const createZeroMatrix = (rows: number, cols: number): number[][] => {

    const matrix = Array<number[]>(rows);
    for(let i = 0; i < rows; i++) {
        matrix[i] = Array<number>(cols).fill(0);
    }
    return matrix;
};

/**
 * Create identity matrix
 *
 * @param size - Side of the matrix
 * @returns Identity matrix
 */
export const createIdentityMatrix = (size: number): number[][] => {

    const matrix = Array<number[]>(size);
    for(let i = 0; i < size; i++) {
        matrix[i] = Array<number>(size).fill(0);
        matrix[i][i] = 1;
    }
    return matrix;
};

/**
 * Create square diagonal matrix
 *
 * @param values - Values to be put on the diagonal
 * @returns Square matrix with the given values on the diagonal
 */
export const createDiagonalMatrix = (values: number[]): number[][] => {

    const size = values.length;
    const matrix = Array<number[]>(size);
    for(let i = 0; i < size; i++) {
        matrix[i] = Array<number>(size).fill(0);
        matrix[i][i] = values[i];
    }

    return matrix;
};

/**
 * Copy matrix
 *
 * @param matrix - Matrix to be copied
 * @returns Copied matrix
 */
export const copyMatrix = (matrix: number[][]): number[][] =>
	matrix.map((row) => [...row]);

/**
 * Transpose matrix
 *
 * @param matrix - Matrix to be transposed
 * @returns Transposed matrix
 */
export const transpose = (matrix: number[][]): number[][] => {

    const rows = matrix.length;
    const cols = matrix[0].length;
    // eslint-disable-next-line sonarjs/arguments-order
    const result = createZeroMatrix(cols, rows);

    for(let i = 0; i < rows; i++) {
        for(let j = 0; j < cols; j++) {
            result[j][i] = matrix[i][j];
        }
    }
    return result;
};

/**
 * Extract matrix column
 *
 * @param matrix - Input matrix
 * @param col - Column to extract
 * @returns Extracted column as vector
 */
export const getColumn = (matrix: number[][], col: number): number[] =>
	matrix.map((row) => row[col]);

/**
 * Extract matrix columns
 *
 * @param matrix - Input matrix
 * @param startCol - Starting column to extract
 * @param endCol - End column to be extracted (excluded)
 * @returns Extracted columns as matrix
 */
export const getColumns = (matrix: number[][], startCol: number, endCol: number): number[][] =>
	matrix.map((row) => row.slice(startCol, endCol));

/**
 * Extract a range of columns from the given row
 *
 * @param matrix - Input matrix
 * @param row - Row to be extracted
 * @param startCol - Start column to extract
 * @param endCol - End column to extract (excluded)
 * @returns Row as a vector
 */
export const getRow = (matrix: number[][], row: number, startCol: number, endCol: number): number[] =>
	matrix[row].slice(startCol, endCol);

/**
 * Vector dot product
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product
 */
export const dotProduct = (a: number[], b: number[]): number =>
	a.reduce((sum, value, i) => sum + value * b[i], 0);

/**
 * Multiply vector by a matrix
 *
 * @param matrix - First factor of the multiplication
 * @param vector - Second factor of the multiplication
 * @returns - Vector result
 */
export const matrixVectorMultiply = (matrix: number[][], vector: number[]): number[] =>
	matrix.map((row) => dotProduct(row, vector));

/**
 * Matrix-matrix multiplication
 *
 * @param a - First factor of the multiplication
 * @param b - Second factor of the multiplication
 * @returns Matrix result
 */
export const matrixMultiply = (a: number[][], b: number[][]): number[][] => {

    const aLength = a.length;
    const a0Length = a[0].length;
    const b0Length = b[0].length;
    const result = createZeroMatrix(aLength, b0Length);

    for(let i = 0; i < aLength; i++) {
        for(let j = 0; j < b0Length; j++) {
            for(let k = 0; k < a0Length; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }

    return result;
};

/**
 * Swap two matrix columns
 *
 * @param matrix - Input matrix
 * @param col1 - First column
 * @param col2 - Second column
 */
export const swapColumns = (matrix: number[][], col1: number, col2: number): void => {

    const len = matrix.length;
    for(let i = 0; i < len; i++) {
        const temp = matrix[i][col1];
        matrix[i][col1] = matrix[i][col2];
        matrix[i][col2] = temp;
    }
};

/**
 * Find the least squares solution to a set of inconsistent linear systems
 *
 * Simple implementation using normal equations: (A^T * A)^-1 * A^T * b
 * For a more robust implementation, consider using SVD or QR decomposition
 *
 * @param a - First matrix
 * @param b - Second matrix
 * @returns Result
 */
export const leastSquares = (a: number[][], b: number[][]): number[][] => {

	const aT = transpose(a);
    const aTa = multiply(aT, a);
    const aTb = multiply(aT, b);
    const aTaInv = inv(aTa);
    return multiply(aTaInv, aTb);
};

/**
 * Compute matrix determinant
 *
 * @param matrix - Input matrix
 * @returns Matrix determinant
 */
export const determinant = (matrix: number[][]): number => {
    return (
        matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
        matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
        matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
    );
};

/**
 * Invert basis matrix
 *
 * @param lattice - Basis matrix
 * @returns Inverted basis matrix
 */
const invertLattice = (lattice: number[][]): number[][] => {

	// Compute the determinant of the basis matrix
	const det = determinant(lattice);

	// Check if the determinant is zero, which means the matrix is not invertible
	if(det === 0) throw Error("Basis matrix is not invertible");

	// Compute the inverse basis matrix
	const invDet = 1 / det;
	return [
		[(lattice[1][1] * lattice[2][2] - lattice[1][2] * lattice[2][1]) * invDet,
		 (lattice[0][2] * lattice[2][1] - lattice[0][1] * lattice[2][2]) * invDet,
		 (lattice[0][1] * lattice[1][2] - lattice[0][2] * lattice[1][1]) * invDet],
		[(lattice[1][2] * lattice[2][0] - lattice[1][0] * lattice[2][2]) * invDet,
		 (lattice[0][0] * lattice[2][2] - lattice[0][2] * lattice[2][0]) * invDet,
		 (lattice[0][2] * lattice[1][0] - lattice[0][0] * lattice[1][2]) * invDet],
		[(lattice[1][0] * lattice[2][1] - lattice[1][1] * lattice[2][0]) * invDet,
		 (lattice[0][1] * lattice[2][0] - lattice[0][0] * lattice[2][1]) * invDet,
		 (lattice[0][0] * lattice[1][1] - lattice[0][1] * lattice[1][0]) * invDet]
	];
};

/**
 * Compute the crystallographyc reciprocal lattice
 *
 * @param lattice - Lattice matrix
 * @returns - Crystallographyc reciprocal lattice
 */
export const reciprocaCrystallographyclLatticeLengths = (lattice: number[][]): number[] => {

    const m = invertLattice(lattice);

    return [
        Math.hypot(m[0][0], m[1][0], m[2][0]),
        Math.hypot(m[0][1], m[1][1], m[2][1]),
        Math.hypot(m[0][2], m[1][2], m[2][2])
    ];
};

/**
 * Helper method to solve 3x3 linear system Ax = b
 *
 * @param A - Coefficient matrix
 * @param b - Constants matrix
 * @returns Solution of Ax = b
 */
export const solveLinearSystem = (A: number[][], b: number[][]): number[][] | undefined => {

    // Simple 3x3 matrix inverse and multiplication
    const det = determinant(A);
    if(Math.abs(det) < 1e-10) return undefined;

    // Calculate inverse matrix
    const invA: number[][] = [
        [
            (A[1][1] * A[2][2] - A[1][2] * A[2][1]) / det,
            (A[0][2] * A[2][1] - A[0][1] * A[2][2]) / det,
            (A[0][1] * A[1][2] - A[0][2] * A[1][1]) / det
        ],
        [
            (A[1][2] * A[2][0] - A[1][0] * A[2][2]) / det,
            (A[0][0] * A[2][2] - A[0][2] * A[2][0]) / det,
            (A[0][2] * A[1][0] - A[0][0] * A[1][2]) / det
        ],
        [
            (A[1][0] * A[2][1] - A[1][1] * A[2][0]) / det,
            (A[0][1] * A[2][0] - A[0][0] * A[2][1]) / det,
            (A[0][0] * A[1][1] - A[0][1] * A[1][0]) / det
        ]
    ];

    // Multiply invA * b
    return multiply(invA, b);
};

/**
 * Compute cell volume
 *
 * @param lattice - Basis matrix
 * @returns Cell volume
 */
export const calculateVolume = (lattice: number[][]): number => {

    return Math.abs(determinant(lattice));
};

/**
 * Compute vectors angle
 *
 * @param v1 - First basis vector
 * @param v2 - Second basis vector
 * @returns Angle between vectors (in degrees)
 */
export const cellAngle = (v1: number[], v2: number[]): number => {

    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const mag1 = Math.hypot(...v1);
    const mag2 = Math.hypot(...v2);
    return Math.acos(dot / (mag1 * mag2))*180/Math.PI;
};

/**
 * Convert fractional coordinates to cartesian coordinates
 *
 * @param fracPoints - Fractional coordinates
 * @param lattice - Basis matrix
 * @returns - Cartesian coordinates
 */
export const getCartesianCoords = (fracPoints: number[][], lattice: number[][]): number[][] => {

    const out: number[][] = [];
    for(const pt of fracPoints) {

        out.push([
            pt[0]*lattice[0][0] + pt[1]*lattice[1][0] + pt[2]*lattice[2][0],
            pt[0]*lattice[0][1] + pt[1]*lattice[1][1] + pt[2]*lattice[2][1],
            pt[0]*lattice[0][2] + pt[1]*lattice[1][2] + pt[2]*lattice[2][2],
        ]);
    }

    return out;
};

/**
 * Convert cartesian coordinates to fractional coordinates
 *
 * @param cartesianPoints - Cartesian coordinates
 * @param lattice - Basis matrix
 * @returns Fractional coordinates
 */
export const getFractionalCoords = (cartesianPoints: number[][], lattice: number[][]): number[][] => {

    const fractionalCoords: number[][] = [];

    const inverse = invertLattice(lattice);

    for(const point of cartesianPoints) {

        fractionalCoords.push([
            point[0]*inverse[0][0] + point[1]*inverse[1][0] + point[2]*inverse[2][0],
			point[0]*inverse[0][1] + point[1]*inverse[1][1] + point[2]*inverse[2][1],
			point[0]*inverse[0][2] + point[1]*inverse[1][2] + point[2]*inverse[2][2]
        ]);
	}

	return fractionalCoords;
};

/**
 * Generate range of values
 *
 * @param start - Start value
 * @param end - End value (excluded)
 * @returns - Array of integers from start to end
 */
export const range = (start: number, end: number): number[] => {

    const result: number[] = [];
    for(let i = start; i < end; ++i) {
        result.push(i);
    }
    return result;
};

/**
 * Multiply vectors by the same matrix
 *
 * @param vectors - vectors to be multiplied
 * @param matrix - Matrix to multiply vectors
 * @returns Matrix composed by the vector results
 */
export const vectorsMatrixMultiply = (vectors: number[][], matrix: number[][]): number[][] => {

    const matrix0Length = matrix[0].length;

	return vectors.map((vector) => {

		const result: number[] = [];
        const vectorLength = vector.length;
		for(let j = 0; j < matrix0Length; j++) {
			result[j] = 0;
			for(let k = 0; k < vectorLength; k++) {
				result[j] += vector[k] * matrix[k][j];
			}
		}
    	return result;
  	});
};

/**
 * Cartesian product between a list of matrices
 *
 * @param arrays - matrices to be multiplied
 * @returns Resulting matrix
 */
export const cartesianProduct = (...arrays: number[][]): number[][] => {
    // eslint-disable-next-line unicorn/no-array-reduce
    return arrays.reduce<number[][]>((accumulator, current) =>
        accumulator.flatMap((a) => current.map((b) => [...a, b])),
        [[]]
    );
};

/**
 * Subtract vectors
 *
 * @param v1 - First vector
 * @param v2 - Second vector
 * @returns Difference of the two vectors
 */
export const subtractVectors = (v1: number[], v2: number[]): number[] => {
    return v1.map((value, i) => value - v2[i]);
};

/**
 * Sum vectors
 *
 * @param v1 - First addendum
 * @param v2 - Second addendum
 * @returns Sum of the two vectors
 */
export const addVectors = (v1: number[], v2: number[]): number[] => {
    return v1.map((value, i) => value + v2[i]);
};

/**
 * Compute the norm of a vector
 *
 * @param vector - Vector to be analyzed
 * @returns Norm of the vector
 */
export const norm = (vector: number[]): number => {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
};

/**
 * Return a value inside [0..1] interval.
 * Math round and Python round behave differently when value is exactly 0.5
 *
 * @param value - Value to be clamped inside [0..1]
 * @returns Clamped value
 */
export const pbc = (value: number): number => {
    if(value > 0.5-1e-5 && value < 0.5+1e-5) return value;
    return value - Math.round(value);
};
