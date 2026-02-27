/**
 * Interpolate the scatter values into a square grid with given sides.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-14
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
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
	const len = points.length;

	for(let i = 0; i < len; i++) {

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
