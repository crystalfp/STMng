/**
 * Compute the matrix of distances between every pair of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-17
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
import {measuringMethods} from "./DistanceMethods";
import {MDS} from "../modules/NativeFunctions";
import {TSNE} from "./TSNE";
import {fixTriangleInequalityViolations} from "../modules/FixTriangleInequality";
import type {FingerprintsAccumulator} from "./Accumulator";

/**
 * Matrix of distances between fingerprints
 */
export class DistanceMatrix {

    private readonly distanceMatrix: number[][] = [];
    private side = 0;
	private readonly id2idx = new Map<number, number>();
	private nextIdx = 0;

    /**
     * Initialize the distance matrix
     *
     * @param countStructures - How many fingerprints will be covered
     * @param distanceVector - Optional distance vector (the one from toVector()) to initialize the matrix
     * @returns Count of distinct distances (i.e., without zero self distances)
     */
    init(countStructures: number, distanceVector?: number[]): number {

        this.side = countStructures;
        this.nextIdx = 0;

        this.id2idx.clear();
		this.distanceMatrix.length = 0;
        for(let i=0; i < countStructures; ++i) {
            this.distanceMatrix.push(Array<number>(countStructures-i).fill(0));
        }

        if(distanceVector) {
            let idx = 0;
            for(let i=0; i < countStructures; ++i) {
                for(let j=1; j < countStructures-i; ++j) {
                    this.distanceMatrix[i][j] = distanceVector[idx++];
                }
            }
        }

        return countStructures*(countStructures-1)/2;
    }

    /**
     * Store a distance between fingerprints of the structure identified by they index
     *
     * @param idRow - Identifier of the structure on the matrix row
     * @param idColumn - Identifier of the structure on the matrix column
     * @param distance - Value to be stored
     * @returns True on success, false on matrix indices out of range
     */
    set(idRow: number, idColumn: number, distance: number): boolean {

		let row = this.mapIndex(idRow);
		let col = this.mapIndex(idColumn);

        if(row >= this.side || col >= this.side) return false;

        // The matrix is symmetrical and only the upper side is stored
		if(col < row) [col, row] = [row, col];
		this.distanceMatrix[row][col-row] = distance;

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

    /**
     * Convert the structure identifier to index in the matrix
     *
     * @param id - Identifier to be mapped to matrix index
     * @returns The matrix index
     */
	private mapIndex(id: number): number {
		let idx;
		if(this.id2idx.has(id)) idx = this.id2idx.get(id)!;
		else {idx = this.nextIdx++; this.id2idx.set(id, idx);}
		return idx;
	}

    /**
     * Return the matrix side
     *
     * @returns Matrix side dimension
     */
    matrixSize(): number {return this.side;}

    /**
     * Compress the distance matrix into a vector
     *
     * @returns The matrix upper triangle without the all zero diagonal
     *          and row by row
     */
    toVector(): number[] {

        const out: number[] = [];
        const len = this.side;

        for(let row=0; row < len-1; ++row) {

            for(let col=1; col < len-row; ++col) {
                out.push(this.distanceMatrix[row][col]);
            }
        }

        return out;
    }

    /**
     * Normalize distances to [0..1]
     */
    normalize(): void {

        let max = 0;
        for(let i=0; i < this.side-1; ++i) {
            for(let j=1; j < this.side-i; ++j) {
                const d = this.distanceMatrix[i][j];
                if(d > max) max = d;
            }
        }
        for(let i=0; i < this.side-1; ++i) {
            for(let j=1; j < this.side-i; ++j) {
                this.distanceMatrix[i][j] /= max;
            }
        }
    }
}

/**
 * Result of computing all distances between the fingerprints
 * @notExported
 */
interface DistanceResult {
    /** Number of distances computed */
    countDistances: number;
    /** Final message */
    endMessage: string;
    /** Error message if any */
    error?: string;
}

/**
 * Routines related to computing the distance between fingerprints
 */
export class Distances {

    private readonly distances = new DistanceMatrix();
    private projectedPoints: number[][] = [];
    private projectedPoints3D: number[][] = [];
    private cachedProjectedPoints = false;
    private useTSNE = false;
    private perplexity = 30;
    private epsilon = 10;
    private iterations = 500;

    /**
     * Return the list of methods names
     *
     * @returns The list of distance methods for the selector on the UI
     */
    static getDistancesMethodsNames(): string[] {

        return measuringMethods.map((method) => method.label);
    }

    /**
     * Access the distance matrix
     *
     * @returns The distance matrix
     */
    getDistanceMatrix(): DistanceMatrix {
        return this.distances;
    }

    /**
     * Compute all the distances between the computed fingerprints
     *
     * @param accumulator - The structure accumulator
     * @param distanceMethod - The selected distance method
     * @param fixTriangleInequality - If the triangle inequality should be checked for all distances
     * @returns Result of the distance computation
     */
    measureAll(accumulator: FingerprintsAccumulator,
               distanceMethod: number,
               fixTriangleInequality: boolean): DistanceResult {

        const countDistances = this.distances.init(accumulator.selectedSize());

        for(const pair of accumulator.iterateSelectedStructurePairs()) {

            const distance = measuringMethods[distanceMethod].method.computeDistance(pair[0], pair[1]);

            const sts = this.distances.set(pair[0].selectedIdx, pair[1].selectedIdx, distance);
            if(!sts) return {
                countDistances,
                endMessage: "Error",
                error: "Indices out of range"
            };
        }

        let endMessage = "Done";

        if(fixTriangleInequality) {

            const sts = fixTriangleInequalityViolations(this.distances);

            switch(sts) {
                case 0:  endMessage = "Fix: no change"; break;
                case 1:  endMessage = "Fixed triangle inequality"; break;
                case -1:
                    return {
                        countDistances,
                        endMessage: "Error",
                        error: "Max iterations exceeded"
                    };
            }
        }

        this.distances.normalize();
        this.cachedProjectedPoints = false;

        return {countDistances, endMessage};
    }

    /**
     * Check if projected points are cached and valid, otherwise compute them
     */
    private checkAndFillCache(): void {

        // No distances, no projected points
        const countPoints = this.distances.matrixSize();
        if(countPoints === 0) {
            this.projectedPoints = [];
            this.projectedPoints3D = [];
            this.cachedProjectedPoints = false;
            return;
        }

        // Check if enabled status changed
        if(this.cachedProjectedPoints) return;

        // Recompute projections if not cached or enabled changed
        if(this.useTSNE) this.projectUsingTSNE(this.perplexity, this.epsilon, this.iterations);
        else {
            const distanceVector = this.distances.toVector();
            const result = MDS(distanceVector, countPoints);
            this.projectedPoints = result.points2D;
            this.projectedPoints3D = result.points3D;
        }
        this.cachedProjectedPoints = true;
    }

    /**
     * Project the points using t-SNE
     *
     * @param perplexity - Perplexity parameter for t-SNE
     * @param epsilon - Learning rate for t-SNE
     * @param iterations - Number of iterations for t-SNE
     */
    private projectUsingTSNE(perplexity: number, epsilon: number, iterations: number): void {

        const tsne = new TSNE({perplexity, dim: 3, epsilon});
        tsne.initDataDistComputed(this.distances.matrixSize(),
                                  this.distances.get.bind(this.distances));
        for(let k = 0; k < iterations; k++) tsne.step();

        this.projectedPoints3D = tsne.getNormalizedSolution();

        const n = this.projectedPoints3D.length;
        this.projectedPoints = Array<number[]>(n);
        for(let i=0; i < n; ++i) {
            this.projectedPoints[i] = [this.projectedPoints3D[i][0], this.projectedPoints3D[i][1]];
        }
    }

    /**
     * Invalidate the projected points cache
     */
    invalidateCachedProjectedPoints(): void {
        this.cachedProjectedPoints = false;
    }

    /**
     * Return the projected points in 2D
     *
     * @param useTSNE - Use t-SNE and not MDS
     * @param perplexity - Perplexity parameter for t-SNE
     * @param epsilon - Learning rate for t-SNE
     * @param iterations - Number of iterations for t-SNE
     * @returns Points in 2D [0..1]x[0..1] that best preserve distances
     */
    getProjectedPoints(useTSNE: boolean, perplexity: number, epsilon: number, iterations: number): number[][] {

        this.useTSNE = useTSNE;
        this.perplexity = perplexity;
        this.epsilon = epsilon;
        this.iterations = iterations;

        this.checkAndFillCache();

        return this.projectedPoints;
    }

    /**
     * Return the projected points in 3D
     *
     * @returns Points in 3D [0..1]x[0..1]x[0..1] that best preserve distances
     */
    getProjectedPoints3D(): number[][] {

        this.checkAndFillCache();

        return this.projectedPoints3D;
    }
}
