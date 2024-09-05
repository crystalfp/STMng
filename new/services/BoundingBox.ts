/**
 * Compute bounding box of the given structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
/* eslint-disable eslint-comments/disable-enable-pair, @typescript-eslint/no-shadow */

import type {PositionType, StructureRenderInfo} from "../types";

/** Type of the returning data */
export interface BoundingBox {
	center: PositionType;
	side: PositionType;
}

/**
 * Compute center and sides of the axis aligned bounding box for the given atoms
 *
 * @param renderInfo - Structure  and other data for which the bounding box should be computed
 * @returns Center and sides of the bounding box
 */
export const getBoundingBox = (renderInfo: StructureRenderInfo): BoundingBox => {

	const {atoms, cell} = renderInfo;
	const {basis, origin} = cell;

	const center: PositionType = [0, 0, 0];

	// If unit cell compute its bounding box
	if(basis.some((value) => value !== 0)) {

		const minCoordinates: PositionType = [0, 0, 0];
		const maxCoordinates: PositionType = [0, 0, 0];

		// Get bounding box from the unit cell
		const vertices = [
			basis[0],                   basis[1],                   basis[2],
			basis[0]+basis[3],          basis[1]+basis[4],          basis[2]+basis[5],
			basis[3],                   basis[4],                   basis[5],
			basis[6],                   basis[7],                   basis[8],
			basis[0]+basis[6],          basis[1]+basis[7],          basis[2]+basis[8],
			basis[0]+basis[3]+basis[6], basis[1]+basis[4]+basis[7], basis[2]+basis[5]+basis[8],
			basis[3]+basis[6],          basis[4]+basis[7],          basis[5]+basis[8],
		];

		for(let i=0; i < 21; i += 3) {

			const x = vertices[i];
			const y = vertices[i+1];
			const z = vertices[i+2];

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

		// Get the center
		center[0] /= 8;
		center[1] /= 8;
		center[2] /= 8;
		center[0] += origin[0];
		center[1] += origin[1];
		center[2] += origin[2];

		// Compute the sides
		const side: PositionType = [
			maxCoordinates[0] - minCoordinates[0],
			maxCoordinates[1] - minCoordinates[1],
			maxCoordinates[2] - minCoordinates[2],
		];
		return {center, side};
	}

	// If there is no unit cell, compute the bounding box from the atoms alone
	const natoms = atoms.length;
	if(natoms === 0) return {center: [0, 0, 0],
							 side: [5, 5, 5]};
	if(natoms === 1) return {center: [atoms[0].position[0], atoms[0].position[1], atoms[0].position[2]],
							 side: [5, 5, 5]};

	// Find the bounding box center and sides
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
