/**
 * Transform a text into a 3D object to be added to the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-17
 */
import {Group, type Mesh, Vector3} from "three";
import type {PositionType} from "@/types";
import {Text as TroikaText} from "troika-three-text";

import localRoboto from "@/assets/Roboto-Regular.ttf";

/**
 * Create a text sprite
 *
 * @param text - The text to display
 * @param color - Color of the text (as #RRGGBB)
 * @param position - Position of the label
 * @param offset - If present gives the offset respect to position
 * @returns The sprite to be added to the scene
 */
export const spriteText = (text: string,
						   color: string,
						   position: PositionType,
						   offset?: PositionType): Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRoboto;
	sprite.text = text;
	sprite.textAlign = "center";
	sprite.fontSize = 0.4;
	sprite.color = color;
	sprite.anchorX = "center";
	sprite.anchorY = "middle";
	if(offset) {
		sprite.position.set(position[0]+offset[0], position[1]+offset[1], position[2]+offset[2]);
	}
	else {
		sprite.position.set(position[0], position[1], position[2]);
	}

	return sprite;
};

/**
 * Compute the middle point between the bonded atoms
 *
 * @param startPosition - Position of the first atom
 * @param endPosition - Position of the second atom
 * @param startRadius - Radius of the first atom
 * @param endRadius - Radius of the second atom
 * @param distance - Distance of the two atoms
 * @returns The label position
 */
const computeLabelPosition = (startPosition: PositionType,
						      endPosition: PositionType,
						      startRadius: number,
						      endRadius: number,
						      distance: number): PositionType => {

	// const r1 = [
	// 	(endPosition[0]-startPosition[0])*startRadius/distance+startPosition[0],
	// 	(endPosition[1]-startPosition[1])*startRadius/distance+startPosition[1],
	// 	(endPosition[2]-startPosition[2])*startRadius/distance+startPosition[2],
	// ];
	// const r2 = [
	// 	(startPosition[0]-endPosition[0])*endRadius/distance+endPosition[0],
	// 	(startPosition[1]-endPosition[1])*endRadius/distance+endPosition[1],
	// 	(startPosition[2]-endPosition[2])*endRadius/distance+endPosition[2],
	// ];
	// return [
	// 	(r1[0]+r2[0])/2+0.15,
	// 	(r1[1]+r2[1])/2+0.15,
	// 	(r1[2]+r2[2])/2+0.15
	// ];

	const cA = startRadius/distance;
	const cB = endRadius/distance;
	const cAB1 = (cA-cB+1)/2;
	const cBA1 = (cB-cA+1)/2;

	return [
		endPosition[0]*cAB1+startPosition[0]*cBA1+0.15,
		endPosition[1]*cAB1+startPosition[1]*cBA1+0.15,
		endPosition[2]*cAB1+startPosition[2]*cBA1+0.15,
	];
};

/**
 * Create a text sprite along a bond
 *
 * @param text - The text to display
 * @param color - Color of the text (as #RRGGBB)
 * @param startPosition - Position of the first atom
 * @param endPosition - Position of the second atom
 * @param startRadius - Radius of the first atom
 * @param endRadius - Radius of the second atom
 * @param distance - Distance of the two atoms
 * @returns The sprite to be added to the scene
 */
export const spriteTextAlongBond = (text: string,
						   			color: string,
						   			startPosition: PositionType,
						   			endPosition: PositionType,
						   			startRadius: number,
						   			endRadius: number,
						   			// eslint-disable-next-line max-params
						   			distance: number): Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRoboto;
	sprite.text = text;
	sprite.textAlign = "center";
	sprite.fontSize = 0.2;
	sprite.fontWeight = "bold";
	sprite.color = color;
	sprite.anchorX = "center";
	sprite.anchorY = "middle";

	// Set center of label
	const pos = computeLabelPosition(startPosition, endPosition, startRadius, endRadius, distance);
	sprite.position.set(pos[0], pos[1], pos[2]);

    // Normalized versors
	const nx = (endPosition[0] - startPosition[0])/distance;
	const ny = (endPosition[1] - startPosition[1])/distance;
	const nz = (endPosition[2] - startPosition[2])/distance;

	// Rotate to be parallel to the bond
    if(ny > 0.99999) sprite.quaternion.set(0, 0, 0, 1);
    else if(ny < -0.99999) sprite.quaternion.set(1, 0, 0, 0);
    else {
        const rotationAxis = new Vector3(nz, 0, -nx).normalize();
        const radians = Math.acos(ny);
        sprite.quaternion.setFromAxisAngle(rotationAxis, radians);
    }
	sprite.rotateZ(Math.PI/2);

	return sprite;
};

/**
 * Dispose labels contained in a group
 *
 * @param group - Group containing Text meshes
 */
export const disposeTextInGroup = (group: Group): void => {

	const labelsToDelete: TroikaText[] = [];
	group.traverse((obj) => {

		if(obj.type === "Mesh") labelsToDelete.push(obj as TroikaText);
	});
	for(const obj of labelsToDelete) {
		group.remove(obj);
		obj.dispose();
	}
};
