/**
 * Fix triangle inequality violations on a distance matrix
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-20
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */

abstract class DistanceMatrixBase {
	abstract matrixSize(): number;
	abstract get(row: number, column: number): number;
	abstract add(row: number, column: number, value: number): void;
}

/**
 * Manage delta values for triangle inequality test
 */
class Delta {

	private readonly delta: number[];
	private readonly nMinus1;
	private readonly nTimesNMinus1Divided2;

	/**
	 * Build the correction matrix to fix the triangle inequality
	 *
	 * @param n - Side of the matrix
	 */
	constructor(n: number) {

		this.nMinus1 = n-1;
		this.nTimesNMinus1Divided2 = (n*(n-1))/2;
		const sz = n*this.nTimesNMinus1Divided2;
		this.delta = Array<number>(sz).fill(0);
	}

	/**
	 * Get one element of the delta matrix
	 *
	 * @param i - First index for the delta parameters matrix
	 * @param j - Second index for the delta parameters matrix
	 * @param k - Third index for the delta parameters matrix
	 * @returns Value in the matrix at (i, j, k)
	 */
	get(i: number, j: number, k: number): number {

		return this.delta[this.deltaIdx(i, j, k)];
	}

	/**
	 * Decrement a matrix element
	 *
	 * @param i - First index for the delta parameters matrix
	 * @param j - Second index for the delta parameters matrix
	 * @param k - Third index for the delta parameters matrix
	 * @param value - Value to be subtracted from the matrix element
	 */
	decr(i: number, j: number, k: number, value: number): void {

		this.delta[this.deltaIdx(i, j, k)] -= value;
	}

	/**
	 * Compute the index in the linearized delta matrix
	 *
	 * @param i - First index for the delta parameters matrix
	 * @param j - Second index for the delta parameters matrix
	 * @param k - Third index for the delta parameters matrix
	 * @returns Index in the linearized array that stores the delta matrix
	 */
	private deltaIdx(i: number, j: number, k: number): number {

		const start = j * this.nMinus1 - ((j - 1) * j) / 2;

		return i * this.nTimesNMinus1Divided2 + start + k - j - 1;
	}
}

/**
 * Count number of violations of the triangular inequality
 *
 * @param distances - Distance matrix
 * @returns - Number of violations of the AC \< AB+BC inequality
 */
const countTriangleInequalityViolations = (distances: DistanceMatrixBase): number => {

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
export const fixTriangleInequalityViolations = (distances: DistanceMatrixBase, maxIterations=10): number => {

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
	return violated > 0 ? -1 : 1;
};
