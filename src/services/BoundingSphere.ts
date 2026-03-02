/**
 * Compute the bounding sphere of the given structure and its unit cell
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-21
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
import {type Group, Box3, Sphere, Vector3} from "three";
import type {PositionType, StructureRenderInfo} from "@/types";

/** Type of the returned data */
export interface BoundingSphere {
	/** Center of the bounding sphere */
	center: PositionType;
	/** Radius of the bounding sphere */
	radius: number;
	/** Center of the bounding sphere (when unit cell visible) */
	centerUC: PositionType;
	/** Radius of the bounding sphere (when unit cell visible) */
	radiusUC: number;
}

/**
 * Compute center and radius of the bounding sphere for the given structure
 *
 * @param renderedStructure - Group containing the rendered structure
 * @param renderInfo - Structure and other data for which the bounding sphere should be computed
 * @returns Center and radius of the bounding sphere (with and without unit cell)
 */
export const getBoundingSphere = (renderedStructure: Group, renderInfo: StructureRenderInfo): BoundingSphere => {

	const {cell} = renderInfo;
	const {basis, origin} = cell;

	// Get bounding box from the rendered structure
	const boundingBox = new Box3().setFromObject(renderedStructure);

	// Bounding sphere without unit cell
	const boundingSphere = boundingBox.getBoundingSphere(new Sphere());
	const sphereCenter = boundingSphere.center;
	const center: PositionType = [sphereCenter.x, sphereCenter.y, sphereCenter.z];
	const radius = boundingSphere.radius;

	// If has unit cell expand the bounding box to contain it
	if(basis.some((value) => value !== 0)) {

		// Get the unit cell vertices
		const vertices = [
			new Vector3(origin[0], 							  origin[1],							origin[2]),
			new Vector3(origin[0]+basis[0],                   origin[1]+basis[1],                   origin[2]+basis[2]),
			new Vector3(origin[0]+basis[0]+basis[3],          origin[1]+basis[1]+basis[4],          origin[2]+basis[2]+basis[5]),
			new Vector3(origin[0]+basis[3],                   origin[1]+basis[4],                   origin[2]+basis[5]),
			new Vector3(origin[0]+basis[6],                   origin[1]+basis[7],                   origin[2]+basis[8]),
			new Vector3(origin[0]+basis[0]+basis[6],          origin[1]+basis[1]+basis[7],          origin[2]+basis[2]+basis[8]),
			new Vector3(origin[0]+basis[0]+basis[3]+basis[6], origin[1]+basis[1]+basis[4]+basis[7], origin[2]+basis[2]+basis[5]+basis[8]),
			new Vector3(origin[0]+basis[3]+basis[6],          origin[1]+basis[4]+basis[7],          origin[2]+basis[5]+basis[8]),
		];

		// Expand the bounding box
		for(const pt of vertices) {

			boundingBox.expandByPoint(pt);
		}
	}
	else return {center, radius, centerUC: center, radiusUC: radius};

	const boundingSphereUC = boundingBox.getBoundingSphere(new Sphere());
	const sphereCenterUC = boundingSphereUC.center;
	const centerUC: PositionType = [sphereCenterUC.x, sphereCenterUC.y, sphereCenterUC.z];
	const radiusUC = boundingSphereUC.radius;

	return {center, radius, centerUC, radiusUC};
};
