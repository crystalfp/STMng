/**
 * Interpolate the scatter values into a square grid with given sides.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-01-14
 */
import {normalizeCoordinates2D} from "./Helpers";

/**
 * Shepard interpolation
 *
 * @param x - Grid point X coordinate
 * @param y - Grid point Y coordinate
 * @param points - List of scatter points coordinates
 * @param values - Corresponding values
 * @param power - Factor to weight distances
 * @returns Interpolated value in the (x, y) point
 */
const shepardInterpolation = (x: number,
							  y: number,
							  points: number[][],
							  values: number[],
							  power = 2): number => {

	let numerator = 0;
	let denominator = 0;

	for(let i = 0; i < points.length; i++) {

		const [px, py] = points[i];
		const distance = Math.hypot(x-px, y-py);
		if(distance === 0) return values[i];

		const weight = 1 / (distance ** power);
		numerator += weight * values[i];
		denominator += weight;
	}

	return numerator / denominator;
};

/**
 * Interpolate a set of points into a square grid
 *
 * @param gridSide - Resulting square grid side
 * @param points - Scatter points to interpolate
 * @param values - Associated values
 * @param power - Factor to weight distances
 * @returns Values on the grid nodes
 */
export const scatterToUniform = (gridSide: number,
								 points: number[][],
								 values: number[],
								 power = 2): number[] => {

	// Normalize mapped points coordinates between 0 and 1
	const normalizedPoints = normalizeCoordinates2D(points);

	const result = Array<number>(gridSide*gridSide).fill(0);

	if(values.length > 0) {

		for(let i = 0; i < gridSide; i++) {
			for(let j = 0; j < gridSide; j++) {

				const x = i / (gridSide - 1);
				const y = j / (gridSide - 1);
				const interpolatedValue = shepardInterpolation(x, y, normalizedPoints, values, power);
				result[j * gridSide + i] = interpolatedValue;
			}
		}
	}

	return result;
};
