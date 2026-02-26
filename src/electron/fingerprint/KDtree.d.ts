/**
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

/**
 * Points from the fingerprinting scatterplot
 * @notExported
 */
interface Glyph {

	/** The original step number or sequence number for fidelity display */
	id: number;

	/** X point coordinate (range 0..1) */
	px: number;

	/** Y point coordinate (range 0..1) */
	py: number;

	/** The color of the point as "#RRGGBB" */
	color: string;

	/** Value associated to the point: group, energy, or delta for fidelity */
	value: number;
}

/**
 * KDtree class
 */
export class KDTree {
	/**
	 * Create the KDtree from the given points
	 *
	 * @param points - Points from the scatterplot
	 * @param keys - Keys of the points objects containing x and y values
	 */
	constructor(points: Glyph[], keys: string[]);

	/**
	 * Function returning the list of points near the given points
	 */
	nearest: (pt: Record<string, number>) => {point: Record<string, number>; squared_distance: number};
}
