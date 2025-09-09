
import {transpose, zeros, column, dot, identity, diag,
        matrix, index, range, subset, multiply, type Matrix} from "mathjs";

/**
 * Perform a Lenstra-Lenstra-Lovasz lattice basis reduction to obtain a
 * c-reduced basis. This method returns a basis which is as "good" as
 * possible, with "good" defined by orthogonality of the lattice vectors.
 *
 * This basis is used for all the periodic boundary condition calculations.
 *
 * @param basis - The lattice matrix (assumed to be 3x3)
 * @param delta - Reduction parameter. Default of 0.75 is usually fine.
 * @returns Tuple of [reduced lattice matrix, mapping to get to that lattice]
 */
export const calculateLLL = (basis: number[][],
                             delta: number = 0.75): [number[][], number[][]] => {

    // Transpose the lattice matrix first so that basis vectors are columns.
    // Makes life easier.
    const a = transpose(matrix(basis));
    const b = matrix(zeros(3, 3));  // Vectors after the Gram-Schmidt process
    const u = matrix(zeros(3, 3));  // Gram-Schmidt coefficients
    const m = new Array(3).fill(0); // These are the norm squared of each vec

    // Initialize first column
    b.subset(index([0, 1, 2], 0), column(a, 0))
    m[0] = dot(column(b, 0), column(b, 0));

    // Gram-Schmidt process for remaining columns
    for(let i = 1; i < 3; i++) {
        // Calculate u[i, :i] = np.dot(a[:, i].T, b[:, :i]) / m[:i]
        for(let j = 0; j < i; j++) {
            u[i][j] = dot(column(a, i), column(b, j)) / m[j];
        }

        // Calculate b[:, i] = a[:, i] - np.dot(b[:, :i], u[i, :i].T)
        const cols = subset(b, index(range(0, 3), range(0, i, true)));
        const rows = subset(u, index(i, range(0, i, true)));
        const temp = multiply(cols, rows);
        for(let row = 0; row < 3; row++) {
            b.set([row, i], a.get([row, i]) - temp.get([row]));
        }

        m[i] = dot(column(b, i), column(b, i));
    }

    let k = 2;
    const mapping = identity(3) as Matrix<number>;

    while(k <= 3) {
        // Size reduction
        for(let i = k - 1; i > 0; i--) {
            const q = Math.round(u.get([k - 1, i - 1]));
            if(q !== 0) {
                // Reduce the k-th basis vector
                for (let row = 0; row < 3; row++) {
                    a[row][k - 1] -= q * a[row][i - 1];
                    mapping[row][k - 1] -= q * mapping[row][i - 1];
                }

                // Update the GS coefficients
                const uu = [...u[i - 1].slice(0, i - 1), 1];
                for (let j = 0; j < i; j++) {
                    u[k - 1][j] -= q * uu[j];
                }
            }
        }

        // Check the Lovasz condition
        const leftSide = dot(column(b, k - 1), column(b, k - 1));
        const rightSide = (delta - Math.abs(u[k - 1][k - 2]) ** 2) *
                          dot(column(b, k - 2), column(b, k - 2));

        if(leftSide >= rightSide) {
            // Increment k if the Lovasz condition holds
            k += 1;
        } else {
            // If the Lovasz condition fails, swap the k-th and (k-1)-th basis vector
            swapColumns(a, k - 1, k - 2);
            swapColumns(mapping, k - 1, k - 2);

            // Update the Gram-Schmidt coefficients
            for(let s = k - 1; s < k + 1; s++) {
                // u[s - 1, : (s - 1)] = np.dot(a[:, s - 1].T, b[:, : (s - 1)]) / m[: (s - 1)]
                for (let j = 0; j < s - 1; j++) {
                    u[s - 1][j] = dot(column(a, s - 1), column(b, j)) / m[j];
                }

                // b[:, s - 1] = a[:, s - 1] - np.dot(b[:, : (s - 1)], u[s - 1, : (s - 1)].T)
                const temp = matrixVectorMultiply(getColumns(b, 0, s - 1), getRow(u, s - 1, 0, s - 1));
                for (let row = 0; row < 3; row++) {
                    b[row][s - 1] = a[row][s - 1] - temp[row];
                }

                m[s - 1] = dot(column(b, s - 1), column(b, s - 1));
            }

            if (k > 2) {
                k -= 1;
            } else {
                // We have to do p/q, so do lstsq(q.T, p.T).T instead
                const aSubMatrix = subset(a, index(range(0, 3), range(k, 3)));
                const bSubMatrix = subset(b, index(range(0, 3), range(k-2, k)));
                const p = multiply(transpose(aSubMatrix), bSubMatrix);
                const q = diag(m.slice(k - 2, k));

                const result = transpose(leastSquares(transpose(q), transpose(p)));

                // u[k:3, (k - 2) : k] = result
                for (let i = k; i < 3; i++) {
                    for (let j = k - 2; j < k; j++) {
                        u[i][j] = result[i - k][j - (k - 2)];
                    }
                }
            }
        }
    }

    return [
        transpose(a).toArray() as number[][],
        transpose(mapping).toArray() as number[][]
    ];
};

// Helper functions
function createZeroMatrix(rows: number, cols: number): number[][] {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
}

function createIdentityMatrix(size: number): number[][] {
    const matrix = createZeroMatrix(size, size);
    for (let i = 0; i < size; i++) {
        matrix[i][i] = 1;
    }
    return matrix;
}

function createDiagonalMatrix(values: number[]): number[][] {
    const size = values.length;
    const matrix = createZeroMatrix(size, size);
    for (let i = 0; i < size; i++) {
        matrix[i][i] = values[i];
    }
    return matrix;
}

function copyMatrix(matrix: number[][]): number[][] {
    return matrix.map(row => [...row]);
}

function tr(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = createZeroMatrix(cols, rows);

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            result[j][i] = matrix[i][j];
        }
    }
    return result;
}

function getColumn(matrix: number[][], col: number): number[] {
    return matrix.map(row => row[col]);
}

function getColumns(matrix: number[][], startCol: number, endCol: number): number[][] {
    return matrix.map(row => row.slice(startCol, endCol));
}

function getRow(matrix: number[][], row: number, startCol: number, endCol: number): number[] {
    return matrix[row].slice(startCol, endCol);
}

function dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => dotProduct(row, vector));
}

function matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result = createZeroMatrix(a.length, b[0].length);

    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b[0].length; j++) {
            for (let k = 0; k < a[0].length; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

function swapColumns(matrix: number[][], col1: number, col2: number): void {
    for (let i = 0; i < matrix.length; i++) {
        const temp = matrix[i][col1];
        matrix[i][col1] = matrix[i][col2];
        matrix[i][col2] = temp;
    }
}

function leastSquares(a: number[][], b: number[][]): number[][] {
    // Simple implementation using normal equations: (A^T * A)^-1 * A^T * b
    // For a more robust implementation, consider using SVD or QR decomposition
    const aT = transpose(a);
    const aTa = matrixMultiply(aT, a);
    const aTb = matrixMultiply(aT, b);

    // This is a simplified inverse calculation for small matrices
    // In production, you'd want to use a proper linear algebra library
    const aTaInv = matrixInverse(aTa);
    return matrixMultiply(aTaInv, aTb);
}

function matrixInverse(matrix: number[][]): number[][] {
    // Simplified 2x2 matrix inverse implementation
    // For larger matrices or production code, use a proper linear algebra library
    const n = matrix.length;
    if (n === 2) {
        const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        if (Math.abs(det) < 1e-10) {
            throw new Error('Matrix is singular');
        }
        return [
            [matrix[1][1] / det, -matrix[0][1] / det],
            [-matrix[1][0] / det, matrix[0][0] / det]
        ];
    }

    // For larger matrices, you'd need Gaussian elimination or LU decomposition
    // This is a placeholder - use a proper math library in production
    throw new Error('Matrix inversion not implemented for matrices larger than 2x2');
}

export const getNiggliReducedLattice = (matrix: number[][]): number[][] => {
	const [reducedMatrix, _] = calculateLLL(matrix);
	return reducedMatrix;
};

const basis = [
    [7.283, 0.47121, -0.27644],
    [1.3812, 7.0908, -0.25494],
    [-0.0025309, 1.2362, 2.0244]
];

const result = calculateLLL(basis);

console.log(result[0]);
console.log(result[1]);
