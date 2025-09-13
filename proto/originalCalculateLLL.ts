/**
 * Perform a Lenstra-Lenstra-Lovasz lattice basis reduction to obtain a
 * c-reduced basis. This method returns a basis which is as "good" as
 * possible, with "good" defined by orthogonality of the lattice vectors.
 *
 * This basis is used for all the periodic boundary condition calculations.
 *
 * @param matrix - The lattice matrix (assumed to be 3x3)
 * @param delta - Reduction parameter. Default of 0.75 is usually fine.
 * @returns Tuple of [reduced lattice matrix, mapping to get to that lattice]
 */
function computeLLL(matrix: number[][], delta = 0.75): [number[][], number[][]] {
    // Transpose the lattice matrix first so that basis vectors are columns.
    // Makes life easier.
    const a = transpose(copyMatrix(matrix));

    const b = createZeroMatrix(3, 3);  // Vectors after the Gram-Schmidt process
    const u = createZeroMatrix(3, 3);  // Gram-Schmidt coefficients
    const m = Array(3).fill(0);    // These are the norm squared of each vec

    // Initialize first column
    for (let i = 0; i < 3; i++) {
        b[i][0] = a[i][0];
    }
    m[0] = dotProduct(getColumn(b, 0), getColumn(b, 0));

    // Gram-Schmidt process for remaining columns
    for (let i = 1; i < 3; i++) {
        // Calculate u[i, :i] = np.dot(a[:, i].T, b[:, :i]) / m[:i]
        for (let j = 0; j < i; j++) {
            u[i][j] = dotProduct(getColumn(a, i), getColumn(b, j)) / m[j];
        }

        // Calculate b[:, i] = a[:, i] - np.dot(b[:, :i], u[i, :i].T)
        const temp = matrixVectorMultiply(getColumns(b, 0, i), getRow(u, i, 0, i));
        for (let row = 0; row < 3; row++) {
            b[row][i] = a[row][i] - temp[row];
        }

        m[i] = dotProduct(getColumn(b, i), getColumn(b, i));
    }

    let k = 2;
    const mapping = createIdentityMatrix(3);

    while (k <= 3) {
        // Size reduction
        for (let i = k - 1; i > 0; i--) {
            const q = Math.round(u[k - 1][i - 1]);
            if (q !== 0) {
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
        const leftSide = dotProduct(getColumn(b, k - 1), getColumn(b, k - 1));
        const rightSide = (delta - Math.abs(u[k - 1][k - 2]) ** 2) *
                         dotProduct(getColumn(b, k - 2), getColumn(b, k - 2));

        if (leftSide >= rightSide) {
            // Increment k if the Lovasz condition holds
            k += 1;
        } else {
            // If the Lovasz condition fails, swap the k-th and (k-1)-th basis vector
            swapColumns(a, k - 1, k - 2);
            swapColumns(mapping, k - 1, k - 2);

            // Update the Gram-Schmidt coefficients
            for (let s = k - 1; s < k + 1; s++) {
                // u[s - 1, : (s - 1)] = np.dot(a[:, s - 1].T, b[:, : (s - 1)]) / m[: (s - 1)]
                for (let j = 0; j < s - 1; j++) {
                    u[s - 1][j] = dotProduct(getColumn(a, s - 1), getColumn(b, j)) / m[j];
                }

                // b[:, s - 1] = a[:, s - 1] - np.dot(b[:, : (s - 1)], u[s - 1, : (s - 1)].T)
                const temp = matrixVectorMultiply(getColumns(b, 0, s - 1), getRow(u, s - 1, 0, s - 1));
                for (let row = 0; row < 3; row++) {
                    b[row][s - 1] = a[row][s - 1] - temp[row];
                }

                m[s - 1] = dotProduct(getColumn(b, s - 1), getColumn(b, s - 1));
            }

            if (k > 2) {
                k -= 1;
            } else {
                // We have to do p/q, so do lstsq(q.T, p.T).T instead
                const aSubMatrix = getColumns(a, k, 3);
                const bSubMatrix = getColumns(b, k - 2, k);
                const p = matrixMultiply(transpose(aSubMatrix), bSubMatrix);
                const q = createDiagonalMatrix(m.slice(k - 2, k));

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

    return [transpose(a), transpose(mapping)];
}

// Helper functions
export function createZeroMatrix(rows: number, cols: number): number[][] {
    return Array(rows).fill(0).map(() => Array(cols).fill(0));
}

export function createIdentityMatrix(size: number): number[][] {
    const matrix = createZeroMatrix(size, size);
    for (let i = 0; i < size; i++) {
        matrix[i][i] = 1;
    }
    return matrix;
}

export function createDiagonalMatrix(values: number[]): number[][] {
    const size = values.length;
    const matrix = createZeroMatrix(size, size);
    for (let i = 0; i < size; i++) {
        matrix[i][i] = values[i];
    }
    return matrix;
}

export function copyMatrix(matrix: number[][]): number[][] {
    return matrix.map(row => [...row]);
}

export function transpose(matrix: number[][]): number[][] {
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

export function getColumn(matrix: number[][], col: number): number[] {
    return matrix.map(row => row[col]);
}

export function getColumns(matrix: number[][], startCol: number, endCol: number): number[][] {
    return matrix.map(row => row.slice(startCol, endCol));
}

export function getRow(matrix: number[][], row: number, startCol: number, endCol: number): number[] {
    return matrix[row].slice(startCol, endCol);
}

export function dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

export function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => dotProduct(row, vector));
}

export function matrixMultiply(a: number[][], b: number[][]): number[][] {
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

export function swapColumns(matrix: number[][], col1: number, col2: number): void {
    for (let i = 0; i < matrix.length; i++) {
        const temp = matrix[i][col1];
        matrix[i][col1] = matrix[i][col2];
        matrix[i][col2] = temp;
    }
}

export function leastSquares(a: number[][], b: number[][]): number[][] {
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

export { computeLLL };
