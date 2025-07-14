/**
 * Compute the matrix of distances between every pair of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-17
 */
import {measuringMethods} from "./DistanceMethods";
import {MDS} from "./MultidimensionalScaling";
import {normalizeCoordinates2D} from "./Helpers";
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
		let idx = 0;
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

        for(let i=0; i < this.side-1; ++i) {

            for(let j=1; j < this.side-i; ++j) {
                out.push(this.distanceMatrix[i][j]);
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

    /**
     * Return the list of methods names
     *
     * @returns The list of distance methods for the selector on the UI
     */
    getDistancesMethodsNames(): string[] {
        const out: string[] = [];
        for(const method of measuringMethods) out.push(method.label);
        return out;
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

            const sts = this.fixTriangleInequalityViolations();

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

        return {countDistances, endMessage};
    }

    /**
     * Count number of violations of the triangular inequality
     *
     * @param matrixSide - Distance matrix side
     * @returns - Number of violations of the AC \< AB+BC inequality
     */
    private countTriangleInequalityViolations(matrixSide: number): number {

        let violated = 0;

        for(let i=0; i < matrixSide-1; ++i) {
            for(let j=i+1; j < matrixSide; ++j) {
                for(let k=j+1; k < matrixSide; ++k) {

                    const dij = this.distances.get(i, j);
                    const djk = this.distances.get(j, k);
                    const dki = this.distances.get(k, i);
                    if(dij > (djk+dki)) ++violated;
                }
            }
        }

        return violated;
    }

    /**
     * Fix triangular inequality violations
     *
     * @returns 0 if everything is OK;
     *          1 if had to fix triangular inequalities;
     *         -1 if maxIterations exceeded
     */
    private fixTriangleInequalityViolations(maxIterations=10): number {

        // Check if fixing needed
        const n = this.distances.matrixSize();

        let violated = this.countTriangleInequalityViolations(n);
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

                            const oDij = this.distances.get(ii, jj);

                            const d1 = delta.get(i, j, k);
                            this.distances.add(ii, jj,  d1);
                            this.distances.add(jj, kk, -d1);
                            this.distances.add(kk, ii, -d1);

                            const d2 = this.distances.get(ii, jj) -
                                       this.distances.get(jj, kk) -
                                       this.distances.get(kk, ii);

                            if(d2 > 0) {
                                this.distances.add(ii, jj, -d2/3);
                                this.distances.add(jj, kk,  d2);
                                this.distances.add(kk, ii,  d2);
                            }
                            delta.decr(i, j, k, this.distances.get(ii, jj) - oDij);
                        }
                    }
                }
            }

            // Check if violations still present
            violated = this.countTriangleInequalityViolations(n);

            // Update the number of iterations
            --maxIterations;
        }
        while(violated > 0 && maxIterations > 0);

        // Check if the max number of iterations has been exceeded
        if(violated > 0) return -1;

        return 1;
    }

    /**
     * Create points in 2D [0..1]x[0..1] that keep distances as best as possible
     */
    projectPoints(): void {

        // No distances, no projected points
        if(this.distances.matrixSize() === 0) {
            this.projectedPoints = [];
            return;
        }

        const distanceVector = this.distances.toVector();
		const mappedPoints = MDS(distanceVector, this.distances.matrixSize());

		// Normalize mapped points coordinates between 0 and 1
        this.projectedPoints = normalizeCoordinates2D(mappedPoints);
    }

    /**
     * Return the projected points
     *
     * @returns Points in 2D [0..1]x[0..1] that keep distances as best as possible
     */
    getProjectedPoints(): number[][] {

        return this.projectedPoints;
    }
}
