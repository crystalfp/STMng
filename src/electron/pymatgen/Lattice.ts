/**
 * Routines translated from Pymatgen lattice.py file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 *
 * This code is ported from the Python Pymatgen library:
 *
 * Shyue Ping Ong, William Davidson Richards, Anubhav Jain, Geoffroy Hautier,
 * Michael Kocher, Shreyas Cholia, Dan Gunter, Vincent Chevrier, Kristin A.
 * Persson, Gerbrand Ceder. Python Materials Genomics (pymatgen): A Robust,
 * Open-Source Python Library for Materials Analysis. Computational Materials
 * Science, 2013, 68, 314–319. https://doi.org/10.1016/j.commatsci.2012.10.028
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
/* eslint-disable unicorn/no-null */
import {inv} from "mathjs";
import {extractBasis, RAD2DEG} from "../modules/Helpers";
import {createZeroMatrix, createIdentityMatrix, createDiagonalMatrix,
        copyMatrix, reciprocaCrystallographyclLatticeLengths,
        transpose, dotProduct, getColumn, matrixVectorMultiply,
        getColumns,
        getRow,
        swapColumns,
        matrixMultiply,
        leastSquares,
        getFractionalCoords,
        range,
        vectorsMatrixMultiply,
        cartesianProduct,
        getCartesianCoords,
        cellAngle,
        solveLinearSystem,
        determinant,
        calculateVolume} from "./Utility";
import type {Lattice} from "./types";

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
const computeLLL = (basis: number[][],
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

function computeCubeIndex(coords: number[][], globalMin: number[], r: number): number[][] {
    return coords.map((coord) =>
        coord.map((c, i) => Math.floor((c - globalMin[i]) / r))
    );
}

function threeToOne(indices: number[][], ny: number, nz: number): number[] {
    return indices.map(([x, y, z]) => x * ny * nz + y * nz + z);
}

/**
 * Given a cube index, find the neighbor cube indices.

    Args:
        label: (array) (n,) or (n x 3) indice array
        nx: (int) number of cells in y direction
        ny: (int) number of cells in y direction
        nz: (int) number of cells in z direction

    Returns:
        Neighbor cell indices.
 */
function findNeighbors(siteIndices: number[], nx: number, ny: number, nz: number): number[][][] {

    return siteIndices.map((index) => {
        // Convert 1D index back to 3D
        const x = Math.floor(index / (ny * nz));
        const y = Math.floor((index % (ny * nz)) / nz);
        const z = index % nz;

        // Find all neighboring cubes (including the cube itself)
        const neighbors: number[][] = [];
        for(let dx = 1; dx >= -1; --dx) {
            for(let dy = 1; dy >= -1; --dy) {
                for(let dz = 1; dz >= -1; --dz) {
                    const nxNew = x + dx;
                    const nyNew = y + dy;
                    const nzNew = z + dz;
                    if(nxNew >= 0 && nxNew < nx &&
                       nyNew >= 0 && nyNew < ny &&
                       nzNew >= 0 && nzNew < nz) {
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
    const v1Length = v1.length;
    const v2Length = v2.length;

    for(let i = 0; i < v1Length; i++) {

        const row: number[] = [];
        for(let j = 0; j < v2Length; j++) {

            // Calculate dot product
            const dp = v1[i][0] * v2[j][0] + v1[i][1] * v2[j][1] + v1[i][2] * v2[j][2];
            let x = dp / (l1[i] * l2[j]);

            // Clamp to [-1, 1] to avoid numerical issues
            x = Math.max(-1, Math.min(1, x));

            const angle = Math.acos(x) * RAD2DEG;
            row.push(angle);
        }
        result.push(row);
    }

    return result;
}

// Helper method to check if arrays are close within tolerance
function isClose(array1: number[][], array2: number[][], atol: number): boolean[][] {

    const result: boolean[][] = [];
    const array1Length = array1.length;

    for(let i = 0; i < array1Length; i++) {
        const row: boolean[] = [];
        const lineLength = array1[i].length;
        for(let j = 0; j < lineLength; j++) {
            const diff = Math.abs(array1[i][j] - array2[i][j]);
            row.push(diff <= atol);
        }
        result.push(row);
    }

    return result;
}

/**
 * Results of neighbor search
 * @notExported
 */
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
function getPointsInSpheres(
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
        const recipLengths = reciprocaCrystallographyclLatticeLengths(lattice);
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

        const coordsInCell = vectorsMatrixMultiply(allFracCoords, matrix);

        // Filter coordinates for each image
        const allValidCoords: number[][] = [];
        const allValidImages: number[][] = [];
        const allValidIndices: number[] = [];

        const images = cartesianProduct(...allRanges);

        for(const image of images) {

            const imageMatrix = vectorsMatrixMultiply([image], matrix)[0];
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
    const cubeToCoords2 = new Map<number, number[][]>();
    const cubeToImages2 = new Map<number, number[][]>();
    const cubeToIndices2 = new Map<number, number[]>();

    let index = 0;
    for(const cubeIdx of allCubeIndex1D) {

        if(cubeToCoords2.has(cubeIdx)) {
            cubeToCoords2.get(cubeIdx)!.push(validCoords[index]);
        }
        else {
            cubeToCoords2.set(cubeIdx, [validCoords[index]]);
        }
        if(cubeToImages2.has(cubeIdx)) {
            cubeToImages2.get(cubeIdx)!.push(validImages[index]);
        }
        else {
            cubeToImages2.set(cubeIdx, [validImages[index]]);
        }
        if(cubeToIndices2.has(cubeIdx)) {
            cubeToIndices2.get(cubeIdx)!.push(validIndices[index]);
        }
        else {
            cubeToIndices2.set(cubeIdx, [validIndices[index]]);
        }
        ++index;
    }

    // Find all neighboring cubes for each atom in the lattice cell
    const siteNeighbors = findNeighbors(siteCubeIndex, nx, ny, nz);
    const neighbors: NeighborResult[][] = [];

    let centerIdx = 0;
    for(const centerCoord of centerCoords) {

        const neighborCubes = siteNeighbors[centerIdx];
        const neighborCubes1D = threeToOne(neighborCubes, ny, nz);

        const validCubes = neighborCubes1D.filter((k) => cubeToCoords2.get(k) && cubeToCoords2.get(k)!.length > 0);

        if(validCubes.length === 0) {
            neighbors.push([]);
            break;
        }

        const nnCoords = validCubes.flatMap((k) => cubeToCoords2.get(k)!);
        const nnImages = validCubes.flatMap((k) => cubeToImages2.get(k)!);
        const nnIndices = validCubes.flatMap((k) => cubeToIndices2.get(k)!);

        const distances = nnCoords.map((coord) =>
            norm(coord.map((value, i) => value - centerCoord[i]))
        );

        const nns: NeighborResult[] = [];

        let index2 = 0;
        for(const coord of nnCoords) {

            const dist = distances[index2];
            if(dist < r + numericalTol) {
                let finalCoord = coord;
                if(returnFcoords && lattice) {
                    const fracCoord = getFractionalCoords([coord], lattice)[0];
                    finalCoord = fracCoord.map((value) => Math.round(value * 1e10) / 1e10);
                }

                nns.push({
                    coord: finalCoord,
                    distance: dist,
                    index: nnIndices[index2],
                    image: nnImages[index2]
                });
            }
            ++index2;
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

    return getPointsInSpheres(
        cartCoords,
        [center],
        r,
        true,
        1e-8,
        lattice,
        true
    )[0];
}

/**
 * Find all mappings between current lattice and another lattice.

        Args:
            other_lattice (Lattice): Another lattice that is equivalent to this one.
            ltol (float): Tolerance for matching lengths. Defaults to 1e-5.
            atol (float): Tolerance for matching angles. Defaults to 1.
            skip_rotation_matrix (bool): Whether to skip calculation of the
                rotation matrix

        Yields:
            (aligned_lattice, rotation_matrix, scale_matrix) if a mapping is
            found. aligned_lattice is a rotated version of other_lattice that
            has the same lattice parameters, but which is aligned in the
            coordinate system of this lattice so that translational points
            match up in 3D. rotation_matrix is the rotation that has to be
            applied to other_lattice to obtain aligned_lattice, i.e.,
            aligned_matrix = np.inner(other_lattice, rotation_matrix) and
            op = SymmOp.from_rotation_and_translation(rotation_matrix)
            aligned_matrix = op.operate_multi(latt.matrix)
            Finally, scale_matrix is the integer matrix that expresses
            aligned_matrix as a linear combination of this
            lattice, i.e., aligned_matrix = np.dot(scale_matrix, self.matrix)

            None is returned if no matches are found.
*/
export function* findAllMappings(
    lattice: number[][],
    otherLattice: number[][],
    ltol = 1e-5,
    atol = 1,
    skipRotationMatrix = false): Generator<[number[][], number[][] | undefined, number[][]]> {

    const lengths = [
        Math.hypot(...otherLattice[0]),
        Math.hypot(...otherLattice[1]),
        Math.hypot(...otherLattice[2])
    ];
    const alpha = cellAngle(otherLattice[2], otherLattice[1]);
    const beta  = cellAngle(otherLattice[0], otherLattice[2]);
    const gamma = cellAngle(otherLattice[0], otherLattice[1]);

    // Get points in sphere around origin
    const maxLength = Math.max(...lengths);
    const sphereData = getPointsInSphere([[0, 0, 0]], [0, 0, 0], maxLength * (1 + ltol), lattice);
    const frac: number[][] = [];
    const dist: number[] = [];
    for(const entry of sphereData) {
        frac.push(entry.coord);
        dist.push(entry.distance);
    }

    const cart = getCartesianCoords(frac, lattice);

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
    const gammaBlength = gammaB.length;
    for(let idx = 0; idx < gammaBlength; ++idx) {

        const gammaBrowLength = gammaB[idx].length;
        for(let j = 0; j < gammaBrowLength; ++j) {
            if(!gammaB[idx][j]) continue;

            const alphaBrowLength = alphaB[j].length;
            for(let k = 0; k < alphaBrowLength; k++) {

                if(!alphaB[j][k] || !betaB[idx][k]) continue;

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

                let rotationM: number[][] | undefined;
                if(!skipRotationMatrix) {
                    rotationM = solveLinearSystem(alignedM, otherLattice);
                }

                yield [alignedM, rotationM, scaleM];
            }
        }
    }
}

/**
 * Find a mapping between current lattice and another lattice. There
        are an infinite number of choices of basis vectors for two entirely
        equivalent lattices. This method returns a mapping that maps
        other_lattice to this lattice.

        Args:
            other_lattice (Lattice): Another lattice that is equivalent to
                this one.
            ltol (float): Tolerance for matching lengths. Defaults to 1e-5.
            atol (float): Tolerance for matching angles. Defaults to 1.
            skip_rotation_matrix (bool): Whether to skip calculation of the rotation matrix.
                Defaults to False.

        Returns:
            tuple[Lattice, NDArray[np.float_], NDArray[np.float_]]: (aligned_lattice, rotation_matrix, scale_matrix)
            if a mapping is found. aligned_lattice is a rotated version of other_lattice that
            has the same lattice parameters, but which is aligned in the
            coordinate system of this lattice so that translational points
            match up in 3D. rotation_matrix is the rotation that has to be
            applied to other_lattice to obtain aligned_lattice, i.e.,
            aligned_matrix = np.inner(other_lattice, rotation_matrix) and
            op = SymmOp.from_rotation_and_translation(rotation_matrix)
            aligned_matrix = op.operate_multi(latt.matrix)
            Finally, scale_matrix is the integer matrix that expresses
            aligned_matrix as a linear combination of this
            lattice, i.e., aligned_matrix = np.dot(scale_matrix, self.matrix)

            None is returned if no matches are found.
 */
const findMapping = (
    lattice: number[][],
    otherLattice: number[][],
    ltol = 1e-5,
    atol = 1,
    skipRotationMatrix = false): [number[][], number[][] | undefined, number[][]] | null => {

    const generator = findAllMappings(lattice, otherLattice, ltol, atol, skipRotationMatrix);
    const result = generator.next();
    return result.done ? null : result.value;
};

/**
 * Get the Niggli reduced lattice using the numerically stable algo
        proposed by R. W. Grosse-Kunstleve, N. K. Sauter, & P. D. Adams,
        Acta Crystallographica Section A Foundations of Crystallography, 2003,
        60(1), 1-6. doi:10.1107/S010876730302186X.
 * @param lattice - The input lattice
 * @param tol - The numerical tolerance. The default of 1e-5 should
 *              result in stable behavior for most cases.
 * @returns Niggli-reduced lattice
 */
export const getNiggliReducedLattice = (lattice: number[][], tol = 1e-5): number[][] => {

    // lll reduction is more stable for skewed cells
	const [reducedMatrix] = computeLLL(lattice);

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
            // A = G[0][0];
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
    const alpha = Math.acos(E / (2 * b * c)) * RAD2DEG;
    const beta  = Math.acos(N / (2 * a * c)) * RAD2DEG;
    const gamma = Math.acos(Y / (2 * a * b)) * RAD2DEG;

    const ll = extractBasis(a, b, c, alpha, beta, gamma);

    const otherLattice = [
        [ll[0], ll[1], ll[2]],
        [ll[3], ll[4], ll[5]],
        [ll[6], ll[7], ll[8]]
    ];

    const mapped = findMapping(lattice, otherLattice, eps, 1, true);
    if(mapped !== null && mapped[0].length > 0) {

        if(determinant(mapped[0]) > 0) {
            return mapped[0];
        }

        // Return lattice with negated matrix
        return [
            [-mapped[0][0][0], -mapped[0][0][1], -mapped[0][0][2]],
            [-mapped[0][1][0], -mapped[0][1][1], -mapped[0][1][2]],
            [-mapped[0][2][0], -mapped[0][2][1], -mapped[0][2][2]]
        ];
    }

    throw new Error("Can't find niggli");
};

/**
 * Create a Lattice starting from its matrix
 *
 * @param matrix - Lattice matrix
 * @returns A full Pymatgen Lattice
 */
export const matrixToLattice = (matrix: number[][]): Lattice => {
	return {
			matrix,
			a: Math.hypot(matrix[0][0], matrix[0][1], matrix[0][2]),
			b: Math.hypot(matrix[1][0], matrix[1][1], matrix[1][2]),
			c: Math.hypot(matrix[2][0], matrix[2][1], matrix[2][2]),
			alpha: cellAngle(matrix[1], matrix[2]),
			beta:  cellAngle(matrix[0], matrix[2]),
			gamma: cellAngle(matrix[0], matrix[1]),
			volume: calculateVolume(matrix),
    };
};

/**
 * Create a Lattice starting from the unit cell parameters
 *
 * @param a - Basis vector a
 * @param b - Basis vector b
 * @param c - Basis vector c
 * @param alpha - Unit cell angle alpha
 * @param beta - Unit cell angle beta
 * @param gamma - Unit cell angle gamma
 * @returns The corresponding Pymatgen Lattice
 */
export const paramsToLattice = (a: number, b: number, c: number,
                                alpha: number, beta: number, gamma: number): Lattice => {

    const ll = extractBasis(a, b, c, alpha, beta, gamma);

    const matrix = [
        [ll[0], ll[1], ll[2]],
        [ll[3], ll[4], ll[5]],
        [ll[6], ll[7], ll[8]]
    ];

    return {
        matrix,
        a,
        b,
        c,
        alpha,
        beta,
        gamma,
        volume: calculateVolume(matrix)
    };
};

/**
 * Compute the reciprocal cell vectors lengths
 *
 * @param matrix - The Pymatgen Lattice matrix
 * @returns Lengths of the reciprocal cell vectors
 */
export const reciprocalLatticeLengths = (matrix: number[][]): number[] => {

	const invMat = inv(matrix);

    const abc = [0, 0, 0];
    for(let row=0; row < 3; ++row) {
        const aa = invMat[0][row];
        const bb = invMat[1][row];
        const cc = invMat[2][row];

        abc[row] = Math.hypot(aa, bb, cc) * 2 * Math.PI;
    }

    return abc;
};

/**
 * Return from get LLL matrices
 * @notExported
 */
interface LLLmatrices {
    /** The LLL matrices */
    matrix: number[][];
    /** Mapping between the original lattice and the LLL reduced lattice */
    inverseMapping: number[][];
}

/**
 * Compute matrices from LLL reduction
 *
 * @param lattice - Lattice for which the LLL matrices should be computed
 * @returns The LLL lattice matrix and the mapping between the original
 *          lattice and the LLL reduced lattice
 */
export const getLLLmatrices = (lattice: Lattice): LLLmatrices => {

    const matrices = computeLLL(lattice.matrix);
    return {
        matrix: matrices[0],
        inverseMapping: inv(matrices[1])
    };
};
