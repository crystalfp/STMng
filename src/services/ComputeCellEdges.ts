/**
 * Compute segments that draw the edges of an unit cell or a supercell
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-18
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
import {BufferGeometry, Float32BufferAttribute} from "three";
import {order3} from "./SharedConstants";

/**
 * Cell edges geometry
 * @remarks Vertices order is: (below) 0-1-2-3 (above) 4-5-6-7
 *
 * @param vertices - Coordinates of the cell vertices
 * @returns - Edges geometry
 */
export const computeCellEdges = (vertices: number[]): BufferGeometry => {

	const points: number[] = [];
	for(let i=0; i < 24; i+=2) {
		const i3 = order3[i];
		const j3 = order3[i+1];
		points.push(vertices[i3], vertices[i3+1], vertices[i3+2],
					vertices[j3], vertices[j3+1], vertices[j3+2]);
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
	return geometry;
};
