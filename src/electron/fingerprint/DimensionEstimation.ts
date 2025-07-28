/**
 * Estimate the real dimensionality of the fingerprint space
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-07-26
 */
import {eigs} from "mathjs";
import type {FingerprintsAccumulator} from "./Accumulator";

const TOL = 1e-10;

/**
 * Compute the estimate of the embedded space dimension
 *
 * @param accumulator - Source of the computed fingerprints
 * @returns The estimated embedded dimension
 */
export const embeddedDimensionEstimator = (accumulator: FingerprintsAccumulator): number => {

    const {count, length, error} = accumulator.getSectionsInfo();
    if(error) return 0;
    const dimension = count * length;
    const sourceFingerprints: number[][] = [];
    const fingerprints: number[][] = [];

    // Collect computed fingerprints
    for(const structure of accumulator.iterateSelectedStructures()) {

        sourceFingerprints.push(structure.fingerprint);
        fingerprints.push([]);
    }
    if(sourceFingerprints.length === 0) return 0;

    // Remove coordinates equal for all fingerprints
    for(let idx = 0; idx < dimension; ++idx) {
        const value = sourceFingerprints[0][idx];
        for(let i=1; i < sourceFingerprints.length; ++i) {
            const delta = Math.abs(sourceFingerprints[i][idx] - value);
            if(delta > TOL) {
                for(let j=0; j < sourceFingerprints.length; ++j) {
                    fingerprints[j].push(sourceFingerprints[j][idx]);
                }
                break;
            }
        }
    }

    // Estimate the embedded space dimension
    const estimator = new DimensionEstimator(fingerprints);

    // console.log("Starting dimension:", fingerprints[0].length);
    // console.log("Dimension Estimation Results:");
    // const results = estimator.estimateAll();

    // for(const result of results) {
    //     console.log(`${result.method}: ${result.estimatedDimension.toFixed(2)}`);
    //     if(result.confidence) {
    //         console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    //     }
    // }

    return estimator.mleDimension().estimatedDimension;
};

/** Estimator result */
interface DimensionEstimate {
    /** Name of the method */
    method: string;
    /** Estimated dimension */
    estimatedDimension: number;
    /** Confidence value (only for PCA) */
    confidence?: number;
    /** Assorted data from the estimator */
    details?: unknown;
}

class DimensionEstimator {

    private readonly matrix: number[][];
    private readonly spaceDimension: number;
    private readonly numPoints: number;

    /**
     * Initialize the estimator
     *
     * @param points - Array of fingerprints
     */
    constructor(points: number[][]) {

        this.matrix = points;
        this.spaceDimension = points[0].length;
        this.numPoints = points.length;
    }

    /**
     * Estimate dimension using correlation dimension (Grassberger-Procaccia algorithm)
     *
     * @param numberRadii - Number of different radius values to test, logarithmically spaced from 0.01 to maxRadius. More radii give a smoother curve for dimension estimation but increase computation time. The dimension is estimated from the slope of log(correlation) vs log(radius).
     * @returns Dimension estimate plus support data
     */
    correlationDimension(numberRadii = 20): DimensionEstimate {

        const n = this.numPoints;

        let meanDistance = 0;
        let distancesCount = 0;
        for(let i = 0; i < n-1; ++i) {
            for(let j = i + 1; j < n; ++j) {
                meanDistance += this.euclideanDistance(i, j);
                ++distancesCount;
            }
        }

        // The maximum distance to consider when counting point pairs.
        // This sets the upper bound for the correlation analysis.
        const maxRadius = meanDistance / (2*distancesCount);

        const radii = this.generateLogSpace(0.01, maxRadius, numberRadii);
        const correlations: number[] = [];

        for(const r of radii) {

            let count = 0;

            for(let i = 0; i < n-1; ++i) {
                for(let j = i + 1; j < n; ++j) {
                    if(this.euclideanDistance(i, j) < r) {
                        ++count;
                    }
                }
            }

            const correlation = count / (n * (n - 1) / 2);
            correlations.push(Math.max(correlation, 1e-10)); // Avoid log(0)
        }

        // Estimate dimension from slope of log(C(r)) vs log(r)
        const logRadii = radii.map((r) => Math.log(r));
        const logCorrelations = correlations.map((c) => Math.log(c));

        const dimension = this.linearRegression(logRadii, logCorrelations).slope;

        return {
            method: "Correlation Dimension",
            estimatedDimension: Math.max(0, dimension),
            details: {radii, correlations, logRadii, logCorrelations}
        };
    }

    /**
     * Estimate dimension using nearest neighbor distances
     *
     * @param k - Which nearest neighbor to use for distance calculation. k=1 uses the closest neighbor, k=5 uses the 5th closest, etc. Larger k values are more robust to noise but may smooth over local structure. Common choices are 3-10 depending on data density.
     * @returns Dimension estimate plus support data
     */
    nearestNeighborDimension(k = 5): DimensionEstimate {

        const distances: number[] = [];

        for(let i = 0; i < this.numPoints; ++i) {
            const neighborDistances: number[] = [];

            for(let j = 0; j < this.numPoints; ++j) {
                if(i !== j) {
                    neighborDistances.push(this.euclideanDistance(i, j));
                }
            }

            neighborDistances.sort((a, b) => a - b);
            distances.push(neighborDistances[k - 1]); // k-th nearest neighbor
        }

        // Use the distribution of k-NN distances to estimate dimension
        const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;

        // Rough estimate based on expected behavior in d-dimensional space
        const dimension = Math.log(this.numPoints) / Math.log(2 / meanDistance);

        return {
            method: "Nearest Neighbor",
            estimatedDimension: Math.max(1, Math.min(dimension, this.spaceDimension)),
            details: {meanDistance, variance, k}
        };
    }

    /**
     * Estimate dimension using PCA (intrinsic dimensionality)
     *
     * @param varianceThreshold - The fraction of total variance that must be explained by the selected principal components. 0.95 means "find the minimum number of dimensions that capture 95% of the data's variance." Higher values (closer to 1.0) give more conservative estimates, lower values give more aggressive dimensionality reduction.
     * @returns Dimension estimate plus support data
     */
    pcaDimension(varianceThreshold = 0.95): DimensionEstimate {

        const centeredMatrix = this.centerMatrix(this.matrix);
        const covarianceMatrix = this.computeCovariance(centeredMatrix);
        const eigenvalues = this.computeEigenvalues(covarianceMatrix);

        // Sort eigenvalues in descending order
        eigenvalues.sort((a, b) => b - a);

        // Find number of components needed to explain variance threshold
        const totalVariance = eigenvalues.reduce((sum, value) => sum + Math.max(0, value), 0);
        let cumulativeVariance = 0;
        let dimension = 0;

        for(let i = 0; i < eigenvalues.length; ++i) {
            cumulativeVariance += Math.max(0, eigenvalues[i]);
            dimension = i + 1;
            if(cumulativeVariance / totalVariance >= varianceThreshold) {
                break;
            }
        }

        return {
            method: "PCA",
            estimatedDimension: dimension,
            confidence: cumulativeVariance / totalVariance,
            details: {eigenvalues, totalVariance, varianceThreshold}
        };
    }

    /**
     * Estimate dimension using maximum likelihood estimation
     *
     * @param k - Number of nearest neighbors to use in the local likelihood estimation. For each point, the algorithm looks at its k nearest neighbors to estimate the local intrinsic dimension. Larger k provides more stable estimates but assumes the manifold is locally linear over a larger neighborhood.
     * @returns Dimension estimate plus support data
     */
    mleDimension(k = 10): DimensionEstimate {

        const n = this.numPoints;
        const dimensions: number[] = [];

        for(let i = 0; i < n; ++i) {
            const distances: number[] = [];

            for(let j = 0; j < n; ++j) {
                if(i !== j) {
                    distances.push(this.euclideanDistance(i, j));
                }
            }

            distances.sort((a, b) => a - b);

            if(distances[k] > 0) {
                let sum = 0;
                for(let j = 0; j < k; ++j) {
                    if(distances[j] > 0) {
                        sum += Math.log(distances[j] / distances[k]);
                    }
                }

                const localDim = -(k - 1) / sum;
                if(Number.isFinite(localDim) && localDim > 0) {
                    dimensions.push(localDim);
                }
            }
        }

        const meanDimension = dimensions.length > 0 ?
            dimensions.reduce((sum, d) => sum + d, 0) / dimensions.length
            : 1;

        return {
            method: "Maximum Likelihood",
            estimatedDimension: Math.max(1, meanDimension),
            details: {localDimensions: dimensions, k}
        };
    }

    /**
     * Comprehensive dimension estimation using multiple methods
     */
    estimateAll(): DimensionEstimate[] {

        const results: DimensionEstimate[] = [];

        try {
            results.push(this.pcaDimension());
        }
        catch(error) {
            console.warn("PCA estimation failed:", error);
        }

        try {
            results.push(this.correlationDimension());
        }
        catch(error) {
            console.warn("Correlation dimension estimation failed:", error);
        }

        try {
            results.push(this.nearestNeighborDimension());
        }
        catch(error) {
            console.warn("Nearest neighbor estimation failed:", error);
        }

        try {
            results.push(this.mleDimension());
        }
        catch(error) {
            console.warn("MLE estimation failed:", error);
        }

        return results;
    }

    /**
     * Compute distance
     *
     * @param idx1 - Index of the first fingerprint
     * @param idx2 - Index of the second fingerprint
     * @returns Euclidean distance between the two fingerprints
     */
    private euclideanDistance(idx1: number, idx2: number): number {

        const coords1 = this.matrix[idx1];
        const coords2 = this.matrix[idx2];
        let sum = 0;

        for(let i = 0; i < coords1.length; ++i) {
            const delta = coords1[i] - coords2[i];
            sum += delta*delta;
        }

        return Math.sqrt(sum);
    }

    /**
     * Generate logarithmic spaced points
     *
     * @param start - Start coordinate
     * @param end - End coordinate
     * @param count - Number of points to generate
     * @returns List of logarithmic coordinates
     */
    private generateLogSpace(start: number, end: number, count: number): number[] {

        const logStart = Math.log(start);
        const logEnd = Math.log(end);
        const step = (logEnd - logStart) / (count - 1);

        return Array.from({length: count}, (_, i) => Math.exp(logStart + i * step));
    }

    /**
     * Compute linear regression
     *
     * @param x - X coordinates
     * @param y - Y coordinates
     * @returns Parameters of the interpolating line
     */
    private linearRegression(x: number[], y: number[]): {slope: number; intercept: number} {

        const n = x.length;
        const sumX = x.reduce((sum, value) => sum + value, 0);
        const sumY = y.reduce((sum, value) => sum + value, 0);
        const sumXY = x.reduce((sum, value, i) => sum + value * y[i], 0);
        const sumXX = x.reduce((sum, value) => sum + value * value, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return {slope, intercept};
    }

    /**
     * Center matrix
     *
     * @param matrix - Matrix to be centered
     * @returns Centered matrix around mean
     */
    private centerMatrix(matrix: number[][]): number[][] {

        const means = Array<number>(matrix[0].length).fill(0);

        // Calculate means
        for(const row of matrix) {
            for(let j = 0; j < row.length; ++j) {
                means[j] += row[j];
            }
        }

        for(let j = 0; j < means.length; ++j) {
            means[j] /= matrix.length;
        }

        // Center the matrix
        return matrix.map((row) => row.map((value, j) => value - means[j]));
    }

    /**
     * Compute covariance matrix
     *
     * @param matrix - Input centered matrix
     * @returns Covariance matrix
     */
    private computeCovariance(matrix: number[][]): number[][] {

        const n = matrix.length;
        const d = matrix[0].length;
        const cov = Array.from({length: d}, () => Array<number>(d).fill(0));

        for(let i = 0; i < d; ++i) {
            for(let j = 0; j < d; ++j) {
                let sum = 0;
                for(let k = 0; k < n; ++k) {
                    sum += matrix[k][i] * matrix[k][j];
                }
                cov[i][j] = sum / (n - 1);
            }
        }

        return cov;
    }

    /**
     * Compute matrix eigenvalues
     *
     * @param matrix - Input matrix
     * @returns List of matrix eigenvalues
     */
    private computeEigenvalues(matrix: number[][]): number[] {

        const eigenvalues: number[] = [];

        const {values} = eigs(matrix, {eigenvectors: false});

        for(const value of (values as number[])) {
            eigenvalues.push(value);
        }

        return eigenvalues;
    }
}
