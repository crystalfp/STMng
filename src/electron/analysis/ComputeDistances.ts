/**
 * Compute the matrix of distances between every pair of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-24
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
import {measuringMethods} from "../fingerprint/DistanceMethods";
import {fixTriangleInequalityViolations} from "../modules/FixTriangleInequality";
import type {StructureSetsAccumulator} from "./Accumulator";
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
 * Fill the distance matrix
 *
 * @param accumulator - Accumulated structures
 * @param indices - List of indices to be analyzed
 * @param distanceMethod - The selected distance method
 * @param fixTriangleInequality - If the triangle inequality should be checked for all distances
 * @returns Resulting distance matrix
 */
export const computeDistances = (accumulator: StructureSetsAccumulator,
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
