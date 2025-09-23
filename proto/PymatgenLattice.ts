/* eslint-disable eslint-comments/disable-enable-pair, unicorn/no-null */
import {extractBasis} from "@/electron/modules/Helpers";

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
export const computeLLL = (basis: number[][],
                           delta = 0.75): [number[][], number[][]] => {

    // Transpose the lattice matrix first so that basis vectors are columns.
    // Makes life easier.
    const a = transpose(copyMatrix(basis));

    const b = createZeroMatrix(3, 3);   // Vectors after the Gram-Schmidt process
    const u = createZeroMatrix(3, 3);   // Gram-Schmidt coefficients
    const m = Array<number>(3).fill(0); // These are the norm squared of each vec

    // Initialize first column
    for(let i = 0; i < 3; i++) b[i][0] = a[i][0];
    m[0] = dotProduct(getColumn(b, 0), getColumn(b, 0));

    // Gram-Schmidt process for remaining columns
    for(let i = 1; i < 3; i++) {
        // Calculate u[i, :i] = np.dot(a[:, i].T, b[:, :i]) / m[:i]
        for(let j = 0; j < i; j++) {
            u[i][j] = dotProduct(getColumn(a, i), getColumn(b, j)) / m[j];
        }

        // Calculate b[:, i] = a[:, i] - np.dot(b[:, :i], u[i, :i].T)
        const temp = matrixVectorMultiply(getColumns(b, 0, i), getRow(u, i, 0, i));
        for(let row = 0; row < 3; row++) {
            b[row][i] = a[row][i] - temp[row];
        }

        m[i] = dotProduct(getColumn(b, i), getColumn(b, i));
    }

    let k = 2;
    const mapping = createIdentityMatrix(3);

    while(k <= 3) {
        // Size reduction
        for(let i = k - 1; i > 0; i--) {
            const q = Math.round(u[k - 1][i - 1]);
            if(q !== 0) {
                // Reduce the k-th basis vector
                for(let row = 0; row < 3; row++) {
                    a[row][k - 1] -= q * a[row][i - 1];
                    mapping[row][k - 1] -= q * mapping[row][i - 1];
                }

                // Update the GS coefficients
                const uu = [...u[i - 1].slice(0, i - 1), 1];
                for(let j = 0; j < i; j++) {
                    u[k - 1][j] -= q * uu[j];
                }
            }
        }

        // Check the Lovasz condition
        const leftSide = dotProduct(getColumn(b, k - 1), getColumn(b, k - 1));
        const rightSide = (delta - Math.abs(u[k - 1][k - 2]) ** 2) *
                           dotProduct(getColumn(b, k - 2), getColumn(b, k - 2));

        if(leftSide >= rightSide) {
            // Increment k if the Lovasz condition holds
            k += 1;
        }
        else {
            // If the Lovasz condition fails, swap the k-th and (k-1)-th basis vector
            swapColumns(a, k - 1, k - 2);
            swapColumns(mapping, k - 1, k - 2);

            // Update the Gram-Schmidt coefficients
            for(let s = k - 1; s < k + 1; s++) {
                // u[s - 1, : (s - 1)] = np.dot(a[:, s - 1].T, b[:, : (s - 1)]) / m[: (s - 1)]
                for(let j = 0; j < s - 1; j++) {
                    u[s - 1][j] = dotProduct(getColumn(a, s - 1), getColumn(b, j)) / m[j];
                }

                // b[:, s - 1] = a[:, s - 1] - np.dot(b[:, : (s - 1)], u[s - 1, : (s - 1)].T)
                const temp = matrixVectorMultiply(getColumns(b, 0, s - 1), getRow(u, s - 1, 0, s - 1));
                for(let row = 0; row < 3; row++) {
                    b[row][s - 1] = a[row][s - 1] - temp[row];
                }

                m[s - 1] = dotProduct(getColumn(b, s - 1), getColumn(b, s - 1));
            }

            if(k > 2) {
                k -= 1;
            }
            else {
                // We have to do p/q, so do lstsq(q.T, p.T).T instead
                const aSubMatrix = getColumns(a, k, 3);
                const bSubMatrix = getColumns(b, k - 2, k);
                const p = matrixMultiply(transpose(aSubMatrix), bSubMatrix);
                const q = createDiagonalMatrix(m.slice(k - 2, k));

                const result = transpose(leastSquares(transpose(q), transpose(p)));

                // u[k:3, (k - 2) : k] = result
                for(let i = k; i < 3; i++) {
                    for(let j = k - 2; j < k; j++) {
                        u[i][j] = result[i - k][j - (k - 2)];
                    }
                }
            }
        }
    }

    return [transpose(a), transpose(mapping)];
};

// Helper functions
const createZeroMatrix = (rows: number, cols: number): number[][] => {

    const matrix = Array<number[]>(rows);
    for(let i = 0; i < rows; i++) {
        matrix[i] = Array<number>(cols).fill(0);
    }
    return matrix;
};

const createIdentityMatrix = (size: number): number[][] => {

    const matrix = Array<number[]>(size);
    for(let i = 0; i < size; i++) {
        matrix[i] = Array<number>(size).fill(0);
        matrix[i][i] = 1;
    }
    return matrix;
};

const createDiagonalMatrix = (values: number[]): number[][] => {

    const size = values.length;
    const matrix = Array<number[]>(size);
    for(let i = 0; i < size; i++) {
        matrix[i] = Array<number>(size).fill(0);
        matrix[i][i] = values[i];
    }

    return matrix;
};

function copyMatrix(matrix: number[][]): number[][] {
    return matrix.map((row) => [...row]);
}

function transpose(matrix: number[][]): number[][] {

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
}

function getColumn(matrix: number[][], col: number): number[] {
    return matrix.map((row) => row[col]);
}

function getColumns(matrix: number[][], startCol: number, endCol: number): number[][] {
    return matrix.map((row) => row.slice(startCol, endCol));
}

function getRow(matrix: number[][], row: number, startCol: number, endCol: number): number[] {
    return matrix[row].slice(startCol, endCol);
}

function dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * b[i], 0);
}

function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => dotProduct(row, vector));
}

function matrixMultiply(a: number[][], b: number[][]): number[][] {
    const result = createZeroMatrix(a.length, b[0].length);

    for(let i = 0; i < a.length; i++) {
        for(let j = 0; j < b[0].length; j++) {
            for(let k = 0; k < a[0].length; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

function swapColumns(matrix: number[][], col1: number, col2: number): void {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for(let i = 0; i < matrix.length; i++) {
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
}

// Matrix determinant helper
const determinant = (matrix: number[][]): number => {
    return (
        matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
        matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
        matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
    );
};

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

// Note: it is the crystallographyc reciprocal lattice
const reciprocalLatticeLengths = (lattice: number[][]): number[] => {

    const m = invertLattice(lattice);

    return [
        Math.hypot(m[0][0], m[1][0], m[2][0]),
        Math.hypot(m[0][1], m[1][1], m[2][1]),
        Math.hypot(m[0][2], m[1][2], m[2][2])
    ];
};

// Helper method to solve linear system Ax = b
function solveLinearSystem(A: number[][], b: number[][]): number[][] | null {

    // Simple 3x3 matrix inverse and multiplication
    const det = determinant(A);
    if(Math.abs(det) < 1e-10) return null;

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
}

// const crossProduct = (a: number[], b: number[]): number[] => {

//     return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
// };

const calculateVolume = (m: number[][]): number => {

    // Calculate determinant of 3x3 matrix
    return Math.abs(
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
};

const cellAngle = (v1: number[], v2: number[]): number => {

    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const mag1 = Math.hypot(...v1);
    const mag2 = Math.hypot(...v2);
    return Math.acos(dot / (mag1 * mag2))*180/Math.PI;
};

/**
 * Convert fractional coordinates to cartesian coordinates
 */
const getCartesianCoords = (fracPoints: number[][], lattice: number[][]): number[][] => {

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

const getFractionalCoords = (cartesianPoints: number[][], lattice: number[][]): number[][] => {

    const fractionalCoords: number[][] = [];

    const inverse = invertLattice(lattice);

    for(const point of cartesianPoints) {

        fractionalCoords.push([point[0]*inverse[0][0] + point[1]*inverse[1][0] + point[2]*inverse[2][0],
							   point[0]*inverse[0][1] + point[1]*inverse[1][1] + point[2]*inverse[2][1],
							   point[0]*inverse[0][2] + point[1]*inverse[1][2] + point[2]*inverse[2][2]]);
	}

	return fractionalCoords;
};


function range(start: number, end: number): number[] {

    const result: number[] = [];
    for(let i = start; i < end; ++i) {
        result.push(i);
    }
    return result;
}

function vectorMatrixMultiply(vectors: number[][], matrix: number[][]): number[][] {
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
}

function cartesianProduct<T>(...arrays: T[][]): T[][] {
    // eslint-disable-next-line unicorn/no-array-reduce
    return arrays.reduce<T[][]>((accumulator, current) =>
        accumulator.flatMap((a) => current.map((b) => [...a, b])),
        [[]]
    );
}

function computeCubeIndex(coords: number[][], globalMin: number[], r: number): number[][] {
    return coords.map((coord) =>
        coord.map((c, i) => Math.floor((c - globalMin[i]) / r))
    );
}

function threeToOne(indices: number[][], ny: number, nz: number): number[] {
    return indices.map(([x, y, z]) => x * ny * nz + y * nz + z);
}

function findNeighbors(siteIndices: number[], nx: number, ny: number, nz: number): number[][][] {

    return siteIndices.map((index) => {
        // Convert 1D index back to 3D
        const x = Math.floor(index / (ny * nz));
        const y = Math.floor((index % (ny * nz)) / nz);
        const z = index % nz;

        // Find all neighboring cubes (including the cube itself)
        const neighbors: number[][] = [];
        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                for(let dz = -1; dz <= 1; dz++) {
                    const nxNew = x + dx;
                    const nyNew = y + dy;
                    const nzNew = z + dz;
                    if(nxNew >= 0 && nxNew < nx && nyNew >= 0 && nyNew < ny && nzNew >= 0 && nzNew < nz) {
                        neighbors.push([nxNew, nyNew, nzNew]);
                    }
                }
            }
        }
        return neighbors;
    });
}

function norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}


// Helper method to calculate angles between vectors
function getAngles(v1: number[][], v2: number[][], l1: number[], l2: number[]): number[][] {
    const result: number[][] = [];

    for(let i = 0; i < v1.length; i++) {
      const row: number[] = [];
      for(let j = 0; j < v2.length; j++) {
        // Calculate dot product
        const dotProduct = v1[i][0] * v2[j][0] + v1[i][1] * v2[j][1] + v1[i][2] * v2[j][2];
        let x = dotProduct / (l1[i] * l2[j]);

        // Clamp to [-1, 1] to avoid numerical issues
        x = Math.max(-1, Math.min(1, x));

        const angle = (Math.acos(x) * 180.0) / Math.PI;
        row.push(angle);
      }
      result.push(row);
    }

    return result;
}

// Helper method to check if arrays are close within tolerance
function isClose(array1: number[][], array2: number[][], atol: number): boolean[][] {
    const result: boolean[][] = [];

    for(let i = 0; i < array1.length; i++) {
        const row: boolean[] = [];
        for(let j = 0; j < array1[i].length; j++) {
            const diff = Math.abs(array1[i][j] - array2[i][j]);
            row.push(diff <= atol);
        }
        result.push(row);
    }

    return result;
}

interface NeighborResult {
    coord: number[];
    distance: number;
    index: number;
    image: number[];
}

/**
 * For each point in centerCoords, get all the neighboring points
 * in allCoords that are within the cutoff radius r.
 *
 * @param allCoords - all available points (Cartesian coordinates)
 * @param centerCoords - all centering points (Cartesian coordinates)
 * @param r - cutoff radius
 * @param pbc - whether to set periodic boundaries
 * @param numericalTol - numerical tolerance
 * @param lattice - lattice to consider when PBC is enabled
 * @param returnFcoords - whether to return fractional coords when pbc is set
 * @returns Array of arrays of neighbor results
 */
export function getPointsInSpheres(
  allCoords: number[][],
  centerCoords: number[][],
  r: number,
  pbc: boolean | boolean[] = true,
  numericalTol = 1e-8,
  lattice?: number[][],
  returnFcoords = false
): NeighborResult[][] {

    // Handle pbc parameter
    const pbcArray = typeof pbc === "boolean" ? [pbc, pbc, pbc] : [...pbc];

    if(returnFcoords && !lattice) {
        throw new Error("Lattice needs to be supplied to compute fractional coordinates");
    }

    // Calculate bounds
    const centerCoordsMin = centerCoords[0].map((_, i) =>
        Math.min(...centerCoords.map((coord) => coord[i]))
    );
    const centerCoordsMax = centerCoords[0].map((_, i) =>
        Math.max(...centerCoords.map((coord) => coord[i]))
    );

    const globalMin = centerCoordsMin.map((v) => v - r - numericalTol);
    const globalMax = centerCoordsMax.map((v) => v + r + numericalTol);

    let validCoords: number[][];
    let validImages: number[][];
    let validIndices: number[];

    if(pbcArray.some(Boolean)) {

        if(!lattice) {
            throw new Error("Lattice needs to be supplied when considering periodic boundary");
        }

        // Compute reciprocal lattice
        const recipLengths = reciprocalLatticeLengths(lattice);
        const maxr = recipLengths.map((len) => Math.ceil((r + 0.15) * len));

        const fracCoords = getFractionalCoords(centerCoords, lattice);
        const fracCoordsMin = fracCoords[0].map((_, i) =>
            Math.min(...fracCoords.map((coord) => coord[i]))
        );
        const fracCoordsMax = fracCoords[0].map((_, i) =>
            Math.max(...fracCoords.map((coord) => coord[i]))
        );

        const nminTemp = fracCoordsMin.map((value, i) => Math.floor(value) - maxr[i]);
        const nmaxTemp = fracCoordsMax.map((value, i) => Math.ceil(value) + maxr[i]);

        const nmin = nminTemp.map((value, i) => (pbcArray[i] ? value : 0));
        const nmax = nmaxTemp.map((value, i) => (pbcArray[i] ? value : 1));

        const allRanges = nmin.map((min, i) => range(min, nmax[i]));
        const matrix = lattice;

        // Get fractional coordinates and wrap periodic boundaries
        const imageOffsets = getFractionalCoords(allCoords, lattice);
        const allFracCoords = imageOffsets.map((coord) =>
            coord.map((value, i) => (pbcArray[i] ? value % 1 : value))
        );

        const finalImageOffsets = imageOffsets.map((coord, i) =>
            coord.map((value, j) => value - allFracCoords[i][j])
        );

        const coordsInCell = vectorMatrixMultiply(allFracCoords, matrix);

        // Filter coordinates for each image
        const allValidCoords: number[][] = [];
        const allValidImages: number[][] = [];
        const allValidIndices: number[] = [];

        const images = cartesianProduct(...allRanges);

        for(const image of images) {
            const imageMatrix = vectorMatrixMultiply([image], matrix)[0];
            const coords = coordsInCell.map((coord) =>
                coord.map((value, i) => value + imageMatrix[i])
            );

            const validIndexBool = coords.map((coord) =>
                coord.every((value, i) => value > globalMin[i] && value < globalMax[i])
            );

            let index = 0;
            for(const coord of coords) {
                if(validIndexBool[index]) {
                    allValidCoords.push(coord);
                    // eslint-disable-next-line no-loop-func
                    allValidImages.push(image.map((value, j) => value - finalImageOffsets[index][j]));
                    allValidIndices.push(index);
                }
                ++index;
            }
        }

        if(allValidCoords.length === 0) {
            return centerCoords.map(() => []);
        }

        validCoords = allValidCoords;
        validImages = allValidImages;
        validIndices = allValidIndices;
    }
    else {
        validCoords = allCoords;
        validImages = allCoords.map(() => [0, 0, 0]);
        validIndices = allCoords.map((_, i) => i);
    }

    // Divide the valid 3D space into cubes and compute the cube ids
    const allCubeIndex = computeCubeIndex(validCoords, globalMin, r);
    const globalMaxCubeIndex = computeCubeIndex([globalMax], globalMin, r)[0];
    const [nx, ny, nz] = globalMaxCubeIndex.map((value) => value + 1);

    const allCubeIndex1D = threeToOne(allCubeIndex, ny, nz);
    const siteCubeIndex = threeToOne(
        computeCubeIndex(centerCoords, globalMin, r),
        ny,
        nz
    );

    // Create cube index to coordinates, images, and indices map
    const cubeToCoords: Record<number, number[][]> = {};
    const cubeToImages: Record<number, number[][]> = {};
    const cubeToIndices: Record<number, number[]> = {};

    let index = 0;
    for(const cubeIdx of allCubeIndex1D) {

        cubeToCoords[cubeIdx].push(validCoords[index]);
        cubeToImages[cubeIdx].push(validImages[index]);
        cubeToIndices[cubeIdx].push(validIndices[index]);
        ++index;
    }

    // Find all neighboring cubes for each atom in the lattice cell
  const siteNeighbors = findNeighbors(siteCubeIndex, nx, ny, nz);
  const neighbors: NeighborResult[][] = [];

//   centerCoords.forEach((centerCoord, centerIdx) => {
    let centerIdx = 0;
    for(const centerCoord of centerCoords) {

        const neighborCubes = siteNeighbors[centerIdx];
        const neighborCubes1D = threeToOne(neighborCubes, ny, nz);

        const validCubes = neighborCubes1D.filter((k) => cubeToCoords[k] && cubeToCoords[k].length > 0);

        if(validCubes.length === 0) {
            neighbors.push([]);
            break;
        }

        const nnCoords = validCubes.flatMap((k) => cubeToCoords[k]);
        const nnImages = validCubes.flatMap((k) => cubeToImages[k]);
        const nnIndices = validCubes.flatMap((k) => cubeToIndices[k]);

        const distances = nnCoords.map((coord) =>
            norm(coord.map((value, i) => value - centerCoord[i]))
        );

        const nns: NeighborResult[] = [];

        let index = 0;
        for(const coord of nnCoords) {

            const dist = distances[index];
            if(dist < r + numericalTol) {
                let finalCoord = coord;
                if(returnFcoords && lattice) {
                    const fracCoord = getFractionalCoords([coord], lattice)[0];
                    finalCoord = fracCoord.map((value) => Math.round(value * 1e10) / 1e10);
                }

                nns.push({
                    coord: finalCoord,
                    distance: dist,
                    index: nnIndices[index],
                    image: nnImages[index]
                });
            }
            ++index;
        }

    neighbors.push(nns);
    ++centerIdx;
  }

  return neighbors;
}

/**
 * Find all points within a sphere from the point taking into account
 * periodic boundary conditions. This includes sites in other periodic images.
 *
 * Algorithm:
 *
 * 1. place sphere of radius r in crystal and determine minimum supercell
 *    (parallelepiped) which would contain a sphere of radius r. for this
 *    we need the projection of a_1 on a unit vector perpendicular
 *    to a_2 & a_3 (i.e. the unit vector in the direction b_1) to
 *    determine how many a_1's it will take to contain the sphere.
 *
 *    Nxmax = r * length_of_b_1 / (2 Pi)
 *
 * 2. keep points falling within r.
 */
function getPointsInSphere(
    fracPoints: number[][],
    center: number[],
    r: number,
    lattice: number[][]): NeighborResult[] {

    const cartCoords = getCartesianCoords(fracPoints, lattice);

    const neighbors = getPointsInSpheres(
        cartCoords,
        [center],
        r,
        true,
        1e-8,
        lattice,
        true
    )[0];

    return neighbors;
}


function* findAllMappings(
    otherLattice: number[][],
    ltol = 1e-5,
    atol = 1,
    skipRotationMatrix = false): Generator<[number[][], number[][] | null, number[][]]> {

    const lengths = [
        Math.hypot(...otherLattice[0]),
        Math.hypot(...otherLattice[1]),
        Math.hypot(...otherLattice[2])
    ];
    const alpha = cellAngle(otherLattice[0], otherLattice[1]);
    const beta  = cellAngle(otherLattice[1], otherLattice[2]);
    const gamma = cellAngle(otherLattice[0], otherLattice[2]);

    // Get points in sphere around origin
    const maxLength = Math.max(...lengths);
    const sphereData = getPointsInSphere([[0, 0, 0]], [0, 0, 0], maxLength * (1 + ltol), otherLattice);

    const frac: number[][] = [];
    const dist: number[] = [];
    for(const entry of sphereData) {
        frac.push(entry.coord);
        dist.push(entry.distance);
    }
    const cart = getCartesianCoords(frac, otherLattice);

    // Filter points by distance for each lattice parameter
    const inds = lengths.map((ln) => {

        return dist.map((d) => {
            const ratio = d / ln;
            return ratio < (1 + ltol) && ratio > 1 / (1 + ltol);
        });
    });
    // Get candidate vectors for each lattice direction
    const cA = cart.filter((_, idx) => inds[0][idx]);
    const cB = cart.filter((_, idx) => inds[1][idx]);
    const cC = cart.filter((_, idx) => inds[2][idx]);

    const fA = frac.filter((_, idx) => inds[0][idx]);
    const fB = frac.filter((_, idx) => inds[1][idx]);
    const fC = frac.filter((_, idx) => inds[2][idx]);

    // Calculate lengths
    const lA = cA.map((c) => Math.hypot(c[0], c[1], c[2]));
    const lB = cB.map((c) => Math.hypot(c[0], c[1], c[2]));
    const lC = cC.map((c) => Math.hypot(c[0], c[1], c[2]));

    // Check angle constraints
    const alphaAngles = getAngles(cB, cC, lB, lC);
    const betaAngles  = getAngles(cA, cC, lA, lC);
    const gammaAngles = getAngles(cA, cB, lA, lB);

    const alphaTarget = Array(alphaAngles.length).fill(null).map(() =>
        Array<number>(alphaAngles[0].length).fill(alpha)
    );
    const betaTarget = Array(betaAngles.length).fill(null).map(() =>
        Array<number>(betaAngles[0].length).fill(beta)
    );
    const gammaTarget = Array(gammaAngles.length).fill(null).map(() =>
        Array<number>(gammaAngles[0].length).fill(gamma)
    );

    const alphaB = isClose(alphaAngles, alphaTarget, atol);
    const betaB  = isClose(betaAngles, betaTarget, atol);
    const gammaB = isClose(gammaAngles, gammaTarget, atol);

    // Find valid combinations
    for(let idx = 0; idx < gammaB.length; idx++) {
      for(let j = 0; j < gammaB[idx].length; j++) {
        if(!gammaB[idx][j]) continue;

        for(let k = 0; k < alphaB.length; k++) {

            if(!alphaB[j]?.[k] || !betaB[idx]?.[k]) continue;

          // Create scale matrix from fractional coordinates
          const scaleM = [
            [fA[idx][0], fA[idx][1], fA[idx][2]],
            [fB[j][0], fB[j][1], fB[j][2]],
            [fC[k][0], fC[k][1], fC[k][2]]
          ];

          // Check determinant
          if(Math.abs(determinant(scaleM)) < 1e-8) {
            continue;
          }

          // Create aligned matrix from Cartesian coordinates
          const alignedM = [
            [cA[idx][0], cA[idx][1], cA[idx][2]],
            [cB[j][0], cB[j][1], cB[j][2]],
            [cC[k][0], cC[k][1], cC[k][2]]
          ];

          let rotationM: number[][] | null = null;
          if(!skipRotationMatrix) {
            rotationM = solveLinearSystem(alignedM, otherLattice);
          }

          yield [alignedM, rotationM, scaleM];
        }
      }
    }
}

const findMapping = (
    otherLattice: number[][],
    ltol = 1e-5,
    atol = 1,
    skipRotationMatrix = false): [number[][], number[][] | null, number[][]] | null => {

    const generator = findAllMappings(otherLattice, ltol, atol, skipRotationMatrix);
    const result = generator.next();
    return result.done ? null : result.value;
};

/**
 * Get the Niggli reduced lattice using the numerically stable algo
        proposed by R. W. Grosse-Kunstleve, N. K. Sauter, & P. D. Adams,
        Acta Crystallographica Section A Foundations of Crystallography, 2003,
        60(1), 1-6. doi:10.1107/S010876730302186X.
 * @param matrix - The input lattice
 * @param tol - The numerical tolerance. The default of 1e-5 should
 *              result in stable behavior for most cases.
 * @returns Niggli-reduced lattice
 */
export const getNiggliReducedLattice = (matrix: number[][], tol = 1e-5): number[][] => {

    // lll reduction is more stable for skewed cells
	const [reducedMatrix] = computeLLL(matrix);

    // Compute cell volume
    const eps = tol * Math.cbrt(calculateVolume(reducedMatrix));
    // Define metric tensor G = matrix * matrix^T
    let G = matrixMultiply(reducedMatrix, transpose(reducedMatrix));

    // Upper limit on iterations
    for(let iter = 0; iter < 100; iter++) {

        // Extract lattice parameters from metric tensor
        let A = G[0][0];
        let B = G[1][1];
        let C = G[2][2];
        let E = 2 * G[1][2];
        let N = 2 * G[0][2];
        let Y = 2 * G[0][1];

        // A1: Ensure A ≤ B
        if(B + eps < A || (Math.abs(A - B) < eps && Math.abs(E) > Math.abs(N) + eps)) {

            const M = [
                [0, -1,  0],
                [-1, 0,  0],
                [0,  0, -1]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));

            // Update parameters
            A = G[0][0];
            B = G[1][1];
            C = G[2][2];
            E = 2 * G[1][2];
            N = 2 * G[0][2];
            Y = 2 * G[0][1];
        }

        // A2: Ensure B ≤ C
        if(C + eps < B || (Math.abs(B - C) < eps && Math.abs(N) > Math.abs(Y) + eps)) {
            const M = [
                [-1, 0, 0],
                [0, 0, -1],
                [0, -1, 0]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
            continue;
        }

        // Calculate signs
        const ll = Math.abs(E) < eps ? 0 : E / Math.abs(E);
        const m = Math.abs(N) < eps ? 0 : N / Math.abs(N);
        const n = Math.abs(Y) < eps ? 0 : Y / Math.abs(Y);

        if(ll * m * n === 1) {

            // A3: All positive or all negative
            const i = ll === -1 ? -1 : 1;
            const j = m === -1 ? -1 : 1;
            const k = n === -1 ? -1 : 1;
            const M = [
                [i, 0, 0],
                [0, j, 0],
                [0, 0, k]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
        }
        else if(ll * m * n === 0 || ll * m * n === -1) {

            // A4: Mixed signs or zeros
            let i = ll === 1 ? -1 : 1;
            let j = m === 1 ? -1 : 1;
            let k = n === 1 ? -1 : 1;

            if(i * j * k === -1) {
                // eslint-disable-next-line unicorn/prefer-switch
                if(n === 0) k = -1;
                else if(m === 0) j = -1;
                else if(ll === 0) i = -1;
            }

            const M = [
                [i, 0, 0],
                [0, j, 0],
                [0, 0, k]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
        }

        // Update parameters after A3/A4
        A = G[0][0];
        B = G[1][1];
        // C = G[2][2];
        E = 2 * G[1][2];
        N = 2 * G[0][2];
        Y = 2 * G[0][1];

        // A5: Reduce E
        if((Math.abs(E) > B + eps) ||
           (Math.abs(E - B) < eps && Y - eps > 2 * N) ||
           (Math.abs(E + B) < eps && -eps > Y)) {
            const M = [
                [1, 0, 0],
                [0, 1, -E / Math.abs(E)],
                [0, 0, 1]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
            continue;
        }

        // A6: Reduce N
        if((Math.abs(N) > A + eps) ||
           (Math.abs(A - N) < eps && Y - eps > 2 * E) ||
           (Math.abs(A + N) < eps && -eps > Y)) {
            const M = [
                [1, 0, -N / Math.abs(N)],
                [0, 1, 0],
                [0, 0, 1]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
            continue;
        }

        // A7: Reduce Y
        if((Math.abs(Y) > A + eps) ||
           (Math.abs(A - Y) < eps && N - eps > 2 * E) ||
           (Math.abs(A + Y) < eps && -eps > N)) {
            const M = [
                [1, -Y / Math.abs(Y), 0],
                [0, 1, 0],
                [0, 0, 1]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
            continue;
        }

        // A8: Final reduction step
        if(-eps > E + N + Y + A + B ||
           (Math.abs(E + N + Y + A + B) < eps && eps < Y + (A + N) * 2)) {
            const M = [
                [1, 0, 1],
                [0, 1, 1],
                [0, 0, 1]
            ];
            G = matrixMultiply(transpose(M), matrixMultiply(G, M));
            continue;
        }

        // If we reach here, the reduction is complete
        break;
    }

    // Extract final lattice parameters
    const A = G[0][0];
    const B = G[1][1];
    const C = G[2][2];
    const E = 2 * G[1][2];
    const N = 2 * G[0][2];
    const Y = 2 * G[0][1];

    const a = Math.sqrt(A);
    const b = Math.sqrt(B);
    const c = Math.sqrt(C);
    const alpha = (Math.acos(E / (2 * b * c)) * 180) / Math.PI;
    const beta  = (Math.acos(N / (2 * a * c)) * 180) / Math.PI;
    const gamma = (Math.acos(Y / (2 * a * b)) * 180) / Math.PI;

    const ll = extractBasis(a, b, c, alpha, beta, gamma);

    const lattice = [
        [ll[0], ll[1], ll[2]],
        [ll[3], ll[4], ll[5]],
        [ll[6], ll[7], ll[8]]
    ];

    const mapped = findMapping(lattice, eps, 1, true);
    if(mapped !== null && mapped[0].length > 0) {

        if(determinant(mapped[0]) > 0) {
            return mapped[0];
        }

        // Return lattice with negated matrix
        const negatedMatrix = [
            [-mapped[0][0][0], -mapped[0][0][1], -mapped[0][0][2]],
            [-mapped[0][1][0], -mapped[0][1][1], -mapped[0][1][2]],
            [-mapped[0][2][0], -mapped[0][2][1], -mapped[0][2][2]]
        ];
        return negatedMatrix;
    }

    throw new Error("Can't find niggli");
};

const basis = [
    [7.283, 0.47121, -0.27644],
    [1.3812, 7.0908, -0.25494],
    [-0.0025309, 1.2362, 2.0244]
];

const result = computeLLL(basis);

// console.log(result[0]);
// console.log(result[1]);
void result;
