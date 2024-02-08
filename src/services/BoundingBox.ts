/**
 * Compute bounding box of the given structure.
 *
 * @packageDocumentation
 */

import type {PositionType, Atom} from "@/types";

/** Type of the returning data */
export interface BoundingBox {
	center: PositionType;
	side: PositionType;
}

/**
 * Compute center and sides of the bounding box for the given atoms
 *
 * @param atoms - List of atoms for which the bounding box should be computed
 * @returns Center and sides of the bounding box
 */
export const getBoundingBox = (atoms: Atom[]): BoundingBox => {

	const natoms = atoms.length;
	if(natoms === 0) return {center: [0, 0, 0],
							 side: [0, 0, 0]};
	if(natoms === 1) return {center: [atoms[0].position[0], atoms[0].position[1], atoms[0].position[2]],
							 side: [0, 0, 0]};

	// Find the bounding box center and sides
	const center: PositionType = [0, 0, 0];
	const minCoordinates: PositionType = [Number.POSITIVE_INFINITY,
										  Number.POSITIVE_INFINITY,
										  Number.POSITIVE_INFINITY];
	const maxCoordinates: PositionType = [Number.NEGATIVE_INFINITY,
										  Number.NEGATIVE_INFINITY,
										  Number.NEGATIVE_INFINITY];

	for(const atom of atoms) {

		const x = atom.position[0];
		const y = atom.position[1];
		const z = atom.position[2];

		center[0] += x;
		center[1] += y;
		center[2] += z;

		if(x < minCoordinates[0]) minCoordinates[0] = x;
		if(y < minCoordinates[1]) minCoordinates[1] = y;
		if(z < minCoordinates[2]) minCoordinates[2] = z;

		if(x > maxCoordinates[0]) maxCoordinates[0] = x;
		if(y > maxCoordinates[1]) maxCoordinates[1] = y;
		if(z > maxCoordinates[2]) maxCoordinates[2] = z;
	}
	center[0] /= natoms;
	center[1] /= natoms;
	center[2] /= natoms;

	const side: PositionType = [
		maxCoordinates[0] - minCoordinates[0],
		maxCoordinates[1] - minCoordinates[1],
		maxCoordinates[2] - minCoordinates[2],
	];
	return {center, side};
};
