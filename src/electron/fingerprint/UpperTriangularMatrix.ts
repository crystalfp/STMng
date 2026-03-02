/**
 * Store and update an upper triangular matrix
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-07
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

/** Store and update an upper triangular matrix */
export class UpperTriangularMatrix {

    private readonly side: number;
    private readonly data: Float64Array;
    private readonly smoothingMatrix: number[][] = [];
    private smoothingMatrixLimit = 1;
    private smoothingMatrixSize = 0;
    private noSmoothing = true;

    /**
     * Constructor for the upper triangular matrix
     *
     * @param side - Size of the matrix (side x side)
     * @param initializer - Optional data to initialize the matrix (default to zero)
     */
    constructor(side: number, initializer=0) {

        this.side = side;
        this.data = new Float64Array((side*(side+1))/2).fill(initializer);
    }

    /**
     * Compute the index in the flattened array for the upper triangular matrix
     *
     * @param row - Row index (0-based)
     * @param col - Column index (0-based)
     * @returns The index in the flattened array for the upper triangular matrix
     *          row should be less or equal to the column index, otherwise
	 * 			the indices are swapped.
     */
    private getIndexInFlattenedArray(row: number, col: number): number {

        // Only valid for upper triangular matrix (row <= col)
        if(row > col) [row, col] = [col, row];

        row = col - row; // row is now the distance from the diagonal

		// Formula for upper triangular matrix
        return (row * (2 * this.side - row + 1)) / 2 + (col - row);
    }

    /**
     * Add a value to the matrix at the specified position smoothing it if needed
     *
     * @param row - Row index (0-based)
     * @param col - Column index (0-based)
     * @param value - Value to be added to the matrix at the specified position
     */
    add(row: number, col: number, value: number): void {

        if(this.noSmoothing) {
            const index = this.getIndexInFlattenedArray(row, col);
            this.data[index] += value;
        }
        else {
            const limit = this.smoothingMatrixLimit;
            const size = this.smoothingMatrixSize;
            for(let i=1-limit; i<limit; i++) {
                for(let j=1-limit; j<limit; j++) {

                    const ri = row+i;
                    if(ri < 0 || ri >= this.side) continue;
                    const rj = col+j;
                    if(rj < 0 || rj >= this.side) continue;
                    if(ri > rj) continue; // Only upper triangular part

                    const index = this.getIndexInFlattenedArray(ri, rj);
                    this.data[index] += value*this.smoothingMatrix[i+size][j+size];
                }
            }
        }
    }

    /**
     * Access the matrix data
     *
     * @returns The vectorized upper triangular part of the matrix
     */
    getVector(): Float64Array {
        return this.data;
    }

    /**
     * Create the smoothing matrix for the Gaussian peak
     *
     * @param peakWidth - The peak width (FWHM) in the same units as binWidth
     * @param binWidth - The step size of the grid (in the same units as peakWidth)
     * @param gridSize - The number of bins in each direction from origin
	 * 					 (side is (2*gridSize+1))
     * @param threshold - The threshold for the Gaussian values to be considered significant
     */
    initSmoothingMatrix(peakWidth: number, binWidth: number,
                        gridSize: number, threshold: number): void {

		// Peak width zero means no peak smoothing
        if(peakWidth <= 0) {
            this.noSmoothing = true;
            return;
        }
        this.noSmoothing = false;

        // Convert FWHM to sigma (standard deviation)
        // FWHM = 2 * sqrt(2 * ln(2)) * sigma ≈ 2.35482 * sigma
        const sigma = peakWidth * 0.424661; // 1 / 2.35482 = 0.424661
        const sigmaSquaredByTwo = 2 * sigma * sigma;

        // Initialize the smoothing grid
        this.smoothingMatrixSize = gridSize;
        const gridDimension = 2 * gridSize + 1;
        this.smoothingMatrix.length = gridDimension;
        for(let i = 0; i < gridDimension; i++) {
            this.smoothingMatrix[i] = Array<number>(gridDimension).fill(0);
        }

        // Calculate gaussian values
        let sum = 0;
        for(let i = 0; i < gridDimension; i++) {

            const x = (i - gridSize) * binWidth;

            for(let j = 0; j < gridDimension; j++) {

                const y = (j - gridSize) * binWidth;

                // Gaussian function: f(x,y) = exp(-(x² + y²)/(2*sigma²))
                const gaussianValue = Math.exp(-(x * x + y * y) / sigmaSquaredByTwo);

                this.smoothingMatrix[i][j] = gaussianValue;
                sum += gaussianValue;
            }
        }

        // Normalize to ensure the sum equals 1
        const normalizationFactor = 1 / sum;

        for(let i = 0; i < gridDimension; i++) {
            for(let j = 0; j < gridDimension; j++) {
                this.smoothingMatrix[i][j] *= normalizationFactor;
            }
        }

        // Find the limits of the significant part of the smoothing matrix
        let j = gridSize;
        for(; j < gridDimension; j++) {
            if(this.smoothingMatrix[gridSize][j] < threshold) break;
        }
        this.smoothingMatrixLimit = j - gridSize;
    }
}
