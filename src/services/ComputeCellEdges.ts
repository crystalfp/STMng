/**
 * Compute segments that draw the edges of an unit cell or a supercell
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-18
 */
import {BufferGeometry, Float32BufferAttribute} from "three";

// Vertex indices multiplied by 3
const order3 = [
	0, 3,
	3, 6,
	6, 9,
	9, 0,
	12, 15,
	15, 18,
	18, 21,
	21, 12,
	0, 12,
	3, 15,
	6, 18,
	9, 21
];
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
