/**
 * Various helper routines used by all fingerprinting methods.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-13
 */
import type {BasisType} from "@/types";

/**
 * Compute the unit cell volume
 *
 * @param basis - Unit cell basis vectors
 * @param isNanocluster - Is nanocluster (i.e., has no unit cell). Default false
 * @returns Unit cell volume or zero for nanoclusters
 */
export const getCellVolume = (basis: Float64Array | BasisType, isNanocluster=false): number =>
    (isNanocluster ?
            0 :
            basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
            basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
            basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7]
    );

/**
 * Normalize mapped points coordinates between 0 and 1
 *
 * @param points - Points to be normalized
 * @returns Input points with coordinates mapped between 0 and 1
 */
export const normalizeCoordinates2D = (points: number[][]): number[][] => {

    // Find limits
    let maxX = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    for(const point of points) {

        if(point[0] > maxX) maxX = point[0];
        if(point[0] < minX) minX = point[0];
        if(point[1] > maxY) maxY = point[1];
        if(point[1] < minY) minY = point[1];
    }

    let denX = maxX - minX;
    if(denX < 1e-10) denX = 1;
    let denY = maxY - minY;
    if(denY < 1e-10) denY = 1;

    const n = points.length;
    const normalizedPoints: number[][] = Array(n) as number[][];
    for(let i=0; i < n; ++i) {

        normalizedPoints[i] = [
            (points[i][0] - minX)/denX,
            (points[i][1] - minY)/denY,
        ];
    }

    return normalizedPoints;
};

/** For rendering the scene if modified */
export class NeedRendering {

    private isSceneModified = true;
    private retry = 0;

    /**
     * Ask if the scene needs rendering because has been changed,
     * then reset the modified flag
     *
     * @returns True if the scene should be rendered
     */
    needRendering(): boolean {

        if(this.isSceneModified) {
            if(this.retry > 2) {
                this.isSceneModified = false;
                this.retry = 0;
            }
            ++this.retry;
            return true;
        }
        return false;
    }

    /**
     * Mark the scene as modified
     */
    setSceneModified(): void {
        this.isSceneModified = true;
    }
}

/** Store and update an upper triangular matrix */
export class UpperTriangularMatrix {

    private readonly side: number;
    private readonly data: Float64Array;

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
     *          row should be less or equal to the column index, otherwise the indices are swapped.
     */
    private getIndexInFlattenedArray(row: number, col: number): number {

        // Only valid for upper triangular matrix (row <= col)
        if(row > col) [row, col] = [col, row];

        row = col - row; // row is now the distance from the diagonal
        // Formula for upper triangular matrix: index = (row * (2*side - row + 1)) / 2 + (col - row)
        return (row * (2 * this.side - row + 1)) / 2 + (col - row);
    }

    /**
     * Add a value to the matrix at the specified position
     *
     * @param row - Row index (0-based)
     * @param col - Column index (0-based)
     * @param value - Value to be added to the matrix at the specified position
     */
    add(row: number, col: number, value: number): void {

        const index = this.getIndexInFlattenedArray(row, col);
        this.data[index] += value;
    }

    /**
     * Access the matrix data
     *
     * @returns The vectorized upper triangular part of the matrix
     */
    getVector(): Float64Array {
        return this.data;
    }
}
