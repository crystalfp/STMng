/**
 * Utility routines for the translated Pymatgen routines.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
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
    const result = createZeroMatrix(a.length, b[0].length);

    for(let i = 0; i < a.length; i++) {
        for(let j = 0; j < b[0].length; j++) {
            for(let k = 0; k < a[0].length; k++) {
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
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for(let i = 0; i < matrix.length; i++) {
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
 * @param a - First matrix
 * @param b - Second matrix
 * @returns Result
 */
export const leastSquares = (a: number[][], b: number[][]): number[][] => {

	const aT = transpose(a);
    const aTa = matrixMultiply(aT, a);
    const aTb = matrixMultiply(aT, b);

    // This is a simplified inverse calculation for small matrices
    // In production, you'd want to use a proper linear algebra library
    const aTaInv = matrixInverse(aTa);
    return matrixMultiply(aTaInv, aTb);
};

const matrixInverse = (matrix: number[][]): number[][] => {
    // Simplified 2x2 matrix inverse implementation
    // For larger matrices or production code, use a proper linear algebra library
    const n = matrix.length;
    if(n === 2) {
        const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        if(Math.abs(det) < 1e-10) {
            throw new Error("Matrix is singular");
        }
        return [
            [matrix[1][1] / det, -matrix[0][1] / det],
            [-matrix[1][0] / det, matrix[0][0] / det]
        ];
    }

    // For larger matrices, you'd need Gaussian elimination or LU decomposition
    // This is a placeholder - use a proper math library in production
    throw new Error("Matrix inversion not implemented for matrices larger than 2x2");
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
export const invertLattice = (lattice: number[][]): number[][] => {

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

// Note: it is the crystallographyc reciprocal lattice
export const reciprocaCrystallographyclLatticeLengths = (lattice: number[][]): number[] => {

    const m = invertLattice(lattice);

    return [
        Math.hypot(m[0][0], m[1][0], m[2][0]),
        Math.hypot(m[0][1], m[1][1], m[2][1]),
        Math.hypot(m[0][2], m[1][2], m[2][2])
    ];
};

// Helper method to solve linear system Ax = b
export const solveLinearSystem = (A: number[][], b: number[][]): number[][] | undefined => {

    // Simple 3x3 matrix inverse and multiplication
    const det = determinant(A);
    if(Math.abs(det) < 1e-10) return;

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
    return matrixMultiply(invA, b);
};

// const crossProduct = (a: number[], b: number[]): number[] => {

//     return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
// };

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

export const getFractionalCoords = (cartesianPoints: number[][], lattice: number[][]): number[][] => {

    const fractionalCoords: number[][] = [];

    const inverse = invertLattice(lattice);

    for(const point of cartesianPoints) {

        fractionalCoords.push([point[0]*inverse[0][0] + point[1]*inverse[1][0] + point[2]*inverse[2][0],
							   point[0]*inverse[0][1] + point[1]*inverse[1][1] + point[2]*inverse[2][1],
							   point[0]*inverse[0][2] + point[1]*inverse[1][2] + point[2]*inverse[2][2]]);
	}

	return fractionalCoords;
};


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

	return vectors.map((vector) => {
		const result: number[] = [];
		for(let j = 0; j < matrix[0].length; j++) {
			result[j] = 0;
			for(let k = 0; k < vector.length; k++) {
				result[j] += vector[k] * matrix[k][j];
			}
		}
    	return result;
  	});
};

export const cartesianProduct = (...arrays: number[][]): number[][] => {
    // eslint-disable-next-line unicorn/no-array-reduce
    return arrays.reduce<number[][]>((accumulator, current) =>
        accumulator.flatMap((a) => current.map((b) => [...a, b])),
        [[]]
    );
};
