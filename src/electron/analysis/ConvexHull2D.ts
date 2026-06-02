/**
 * Compute the convex hull in the plane
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-10
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
import {quickHull} from "@derschmale/tympanum";

/**
 * Return type of the convexHullVE routine
 * @notExported
 */
interface ConvexHullVE {
	/** Convex hull vertices X coordinates (volume) */
	vertexX: number[];
	/** Convex hull vertices Y coordinates (energy) */
	vertexY: number[];
	/** Index in the points array */
	index: number[];
}

/**
 * Compute the convex hull in the plane
 *
 * @param points - Points in the chart
 * @param limit - Maximum value of the normal to classify the facet as a bottom one
 * @returns Convex hull vertices and index in the points array
 */
export const convexHull2D = (points: number[][], limit: number): ConvexHullVE => {

	// Find convex hull (only the lower part)
	// The facet is encoded as (normal[2], offset)
	const hull = quickHull(points);
	const toOrder: {x: number; y: number; idx: number}[] = [];
	for(const facet of hull) {

		if(facet.plane[1] < limit) {
			const [v1, v2] = facet.verts;

			toOrder.push({x: points[v1][0], y: points[v1][1], idx: v1},
						 {x: points[v2][0], y: points[v2][1], idx: v2});
		}
	}

	// Sort convex hull points by increasing x value
	toOrder.sort((a, b) => {
		if(a.x !== b.x) return a.x - b.x;
		return a.y - b.y;
	});

	// Remove duplicated convex hull points
	const len = toOrder.length;
	const vertexX = [toOrder[0].x];
	const vertexY = [toOrder[0].y];
	const index   = [toOrder[0].idx];
	for(let i=0, j=1; j < len; ++j) {
		if(Math.abs(toOrder[i].x-toOrder[j].x) > 1e-4 ||
			Math.abs(toOrder[i].y-toOrder[j].y) > 1e-4) {
			vertexX.push(toOrder[j].x);
			vertexY.push(toOrder[j].y);
			index.push(toOrder[j].idx);
			i = j;
		}
	}

	return {
		vertexX,
		vertexY,
		index
	};
};
