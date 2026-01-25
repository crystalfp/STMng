/**
 * Compute the matrix of distances between every pair of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-24
 */
import {measuringMethods} from "../fingerprint/DistanceMethods";
import {Delta} from "../fingerprint/Distances";
import type {VariableCompositionAccumulator} from "./Accumulator";
import type {StructureReduced} from "../fingerprint/Accumulator";

/**
 * Distance matrix encapsulation
 */
export class DistanceMatrix {

	private readonly size: number;
	private readonly distanceMatrix: number[][];

	/**
	 * Create the distance matrix
	 *
	 * @param size - Side of the distance matrix
	 */
	constructor(size: number) {

		this.size = size;
		this.distanceMatrix = Array<number[]>(size);

		for(let i=0; i < size; ++i) {
			this.distanceMatrix[i] = Array<number>(size-i).fill(0);
		}
	}

    /**
     * Store a distance between fingerprints
     *
     * @param row - Row matrix index
     * @param column - Column matrix index
     * @param distance - Value to be stored
     * @returns True on success, false on matrix indices out of range
     */
	set(row: number, column: number, distance: number): boolean {

        if(row >= this.size || column >= this.size) return false;

		// The matrix is symmetrical and only the upper side is stored
		if(column < row) [column, row] = [row, column];
		this.distanceMatrix[row][column-row] = distance;

		return true;
	}

    /**
     * Access the matrix values
     *
     * @param row - Row matrix index
     * @param column - Column matrix index
     * @returns - Value from the matrix
     */
    get(row: number, column: number): number {

		if(column < row) [column, row] = [row, column];
		return this.distanceMatrix[row][column-row];
    }

    /**
     * Normalize distances to [0..1]
     */
    normalize(): void {

        let max = 0;
        for(let i=0; i < this.size-1; ++i) {
            for(let j=1; j < this.size-i; ++j) {
                const d = this.distanceMatrix[i][j];
                if(d > max) max = d;
            }
        }
        for(let i=0; i < this.size-1; ++i) {
            for(let j=1; j < this.size-i; ++j) {
                this.distanceMatrix[i][j] /= max;
            }
        }
    }

	/**
	 * Get matrix side
	 *
	 * @returns Side of the matrix
	 */
	matrixSize(): number {
		return this.size;
	}

    /**
     * Add a value to a matrix element
     *
     * @param row - Row matrix index
     * @param column - Column matrix index
     * @param value - Value to be added to the matrix element
     */
    add(row: number, column: number, value: number): void {

		if(column < row) [column, row] = [row, column];
		this.distanceMatrix[row][column-row] += value;
    }
}

/**
 * Count number of violations of the triangular inequality
 *
 * @param distances - Distance matrix
 * @returns - Number of violations of the AC \< AB+BC inequality
 */
const countTriangleInequalityViolations = (distances: DistanceMatrix): number => {

	let violated = 0;
	const matrixSide = distances.matrixSize();

	for(let i=0; i < matrixSide-1; ++i) {
		for(let j=i+1; j < matrixSide; ++j) {
			for(let k=j+1; k < matrixSide; ++k) {

				const dij = distances.get(i, j);
				const djk = distances.get(j, k);
				const dki = distances.get(k, i);
				if(dij > (djk+dki)) ++violated;
			}
		}
	}

	return violated;
};

/**
 * Fix triangular inequality violations
 *
 * @param distances - Distance matrix
 * @param maxIterations - Maximum number of corrective iterations
 * @returns 0 if everything is OK;
 *          1 if had to fix triangular inequalities;
 *         -1 if maxIterations exceeded
 */
const fixTriangleInequalityViolations = (distances: DistanceMatrix, maxIterations=10): number => {

	// Check if fixing needed
	const n = distances.matrixSize();

	let violated = countTriangleInequalityViolations(distances);
	if(violated === 0) return 0; // Fixing not needed

	// Allocate the correction matrix
	const delta = new Delta(n);

	// While the matrix is not fixed, apply the algorithm
	do {
		for(let i=0; i < n-1; ++i) {
			for(let j=i+1; j < n; ++j) {
				for(let k=j+1; k < n; ++k) {
					for(let t=0; t < 3; ++t) {

						/* eslint-disable @stylistic/max-statements-per-line */
						let ii, jj, kk;
						switch(t) {
							case 2:  ii = k; jj = i; kk = j; break;
							case 1:  ii = j; jj = k; kk = i; break;
							default: ii = i; jj = j; kk = k; break; // Was case 0:
						}
						/* eslint-enable @stylistic/max-statements-per-line */

						const oDij = distances.get(ii, jj);

						const d1 = delta.get(i, j, k);
						distances.add(ii, jj,  d1);
						distances.add(jj, kk, -d1);
						distances.add(kk, ii, -d1);

						const d2 = distances.get(ii, jj) -
									distances.get(jj, kk) -
									distances.get(kk, ii);

						if(d2 > 0) {
							distances.add(ii, jj, -d2/3);
							distances.add(jj, kk,  d2);
							distances.add(kk, ii,  d2);
						}
						delta.decr(i, j, k, distances.get(ii, jj) - oDij);
					}
				}
			}
		}

		// Check if violations still present
		violated = countTriangleInequalityViolations(distances);

		// Update the number of iterations
		--maxIterations;
	}
	while(violated > 0 && maxIterations > 0);

	// Check if the max number of iterations has been exceeded
	if(violated > 0) return -1;

	return 1;
};

/**
 * Fill the distance matrix
 *
 * @param accumulator - Accumulated structures
 * @param indices - List of indices to be analyzed
 * @param distanceMethod - The selected distance method
 * @param fixTriangleInequality - If the triangle inequality should be checked for all distances
 * @returns Resulting distance matrix
 */
export const computeDistances = (accumulator: VariableCompositionAccumulator,
								 indices: number[],
								 distanceMethod: number,
								 fixTriangleInequality: boolean): DistanceMatrix => {

	const distanceMatrix: DistanceMatrix = new DistanceMatrix(indices.length);
	const n = indices.length;

	for(let row=0; row < n-1; ++row) {

		const entryRow = accumulator.getEntry(indices[row]);
		if(entryRow === undefined) continue;

		for(let col=row+1; col < n; ++col) {

			const entryCol = accumulator.getEntry(indices[col]);
			if(entryCol === undefined) continue;

			const fp0 = entryRow as unknown as StructureReduced;
			const fp1 = entryCol as unknown as StructureReduced;
            const distance = measuringMethods[distanceMethod].method.computeDistance(fp0, fp1);
			distanceMatrix.set(row, col, distance);
		}
	}

	if(fixTriangleInequality) {

		fixTriangleInequalityViolations(distanceMatrix);
	}

	distanceMatrix.normalize();

	return distanceMatrix;
};
