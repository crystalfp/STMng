/**
 * Compute the convex hull in the space of mapped points and energies
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-01-23
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
import {quickHull} from "@derschmale/tympanum";

/**
 * Compute the 4D convex hull and take the lower half points starting
 * from 3D projected points plus energies
 *
 * @param mappedPoints - Points projected to 3D
 * @param enabled - If the point is enabled or not
 * @param energies - Corresponding energies
 * @returns List of indices of the selected and enabled points
 */
export const generalizedConvexHull4D = (mappedPoints: number[][],
										enabled: boolean[],
										energies: number[]): number[] => {

	// Prepare 4D points
	const generalizedPoints: number[][] = [];
	let idx = 0;
	for(const mappedPoint of mappedPoints) {
		if(enabled[idx]) {
			generalizedPoints.push([
				mappedPoint[0],
				mappedPoint[1],
				mappedPoint[2],
				energies[idx]
			]);
		}
		++idx;
	}

	// Create the 4D convex hull
	const hull = quickHull(generalizedPoints);

	// Extract the lower side vertices
	// The plane is encoded as (normal[4], offset)
	const vertices = new Set<number>();
	for(const facet of hull) {
		if(facet.plane[3] <= 0) {
			for(const vv of facet.verts) vertices.add(vv);
		}
	}

	return [...vertices];
};
