/**
 * Create arrows in the direction of the basis vectors
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-16
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {Vector3, Group, MeshStandardMaterial, DoubleSide, Mesh,
		CylinderGeometry, ConeGeometry} from "three";
import {spriteText} from "./SpriteText";
import type {PositionType} from "@/types";

/**
* Create an arrow in the direction of the basis vector
*
* @param basis - Basis vector to be show
* @param origin - Unit cell origin
* @param size - Base size of the arrows
* @param color - Color of the arrow and the label
* @param axisLabel - Label on the vector
* @param group - The arrow is added to this group
*/
export const basisVectorArrow = (basis: Vector3, origin: Vector3,
						  size: number, color: string, axisLabel: string,
						  group: Group): void => {

	const versor = basis.clone().normalize();
	const basisLen = basis.length();

	const coneSize = 2*size;
	const coneLen = 5*size;

	const material = new MeshStandardMaterial({
		color,
		roughness: 0.5,
		metalness: 0.6,
		side: DoubleSide
	});

	const cylinder = new Mesh(
		new CylinderGeometry(size, size, basisLen-coneLen, 10),
		material
	);

	cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), versor);
	cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

	// Arrow tips
	const cone = new Mesh(
		new ConeGeometry(coneSize, coneLen, 10, 1),
		material
	);

	cone.quaternion.copy(cylinder.quaternion);
	cone.position.addVectors(basis, origin);
	cone.position.addScaledVector(versor, -coneLen/2);

	// Correlate label size to axis length for legibility
	const labelSize = 0.4 + 0.6*(basisLen-0.5)/19.5;

	// Label
	const labelPosition: PositionType = [
		basis.x+origin.x+versor.x*0.1,
		basis.y+origin.y+versor.y*0.1,
		basis.z+origin.z+versor.z*0.1
	];
	const sprite = spriteText(axisLabel, color, labelSize, labelPosition);

	group.add(cylinder, cone, sprite);
};
