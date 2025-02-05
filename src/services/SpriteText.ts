/**
 * Transform a text into a 3D object to be added to the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-17
 */
import log from "electron-log";
import {type Group, type Mesh, Vector3, type Quaternion} from "three";
import {Text as TroikaText, preloadFont} from "troika-three-text";
import type {PositionType} from "@/types";

import localRobotoRegular from "@/assets/Roboto-Regular.ttf";
import localRobotoBold from "@/assets/Roboto-Bold.ttf";

/**
 * Create a text sprite
 *
 * @param text - The text to display
 * @param color - Color of the text (as #RRGGBB or color name)
 * @param position - Position of the label
 * @returns The sprite to be added to the scene
 */
export const spriteText = (text: string,
						   color: string,
						   position: PositionType): Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRobotoRegular;
	sprite.text = text;
	sprite.textAlign = "center";
	sprite.fontSize = 0.4;
	sprite.color = color;
	sprite.anchorX = "center";
	sprite.anchorY = "middle";

	sprite.position.set(position[0], position[1], position[2]);

	sprite.sync();

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
	// 	(r1[0]+r2[0])/2,
	// 	(r1[1]+r2[1])/2,
	// 	(r1[2]+r2[2])/2
	// ];

	// const cA = startRadius/distance;
	// const cB = endRadius/distance;
	// const cAB1 = (cA-cB+1)/2;
	// const cBA1 = (cB-cA+1)/2;

	const cAcB = (startRadius-endRadius)/distance;
	const cAB1 = (cAcB+1)/2;
	const cBA1 = (1-cAcB)/2;

	return [
		endPosition[0]*cAB1+startPosition[0]*cBA1,
		endPosition[1]*cAB1+startPosition[1]*cBA1,
		endPosition[2]*cAB1+startPosition[2]*cBA1
	];
};

/**
 * Rotate label to align to the final vector
 *
 * @param startPosition - Start of the final vector
 * @param endPosition - End of the final vector
 * @param quaternion - Rotation quaternion to move the label to align to the final vector
 */
const rotateLabel = (startPosition: PositionType,
					 endPosition: PositionType,
					 quaternion: Quaternion): void => {

	const v1 = new Vector3(1, 0, 0);
	const v2 = new Vector3(endPosition[0] - startPosition[0],
						   endPosition[1] - startPosition[1],
						   endPosition[2] - startPosition[2]);

	// Normalize vectors (v1 is already normalized)
	const normalizedV1 = v1; // const normalizedV1 = v1.normalize();
	const normalizedV2 = v2.normalize();

	// Apply the rotation quaternion
	quaternion.setFromUnitVectors(normalizedV1, normalizedV2);
};

/**
 * Create a text sprite along a bond
 *
 * @param text - The text to display
 * @param color - Color of the text (as #RRGGBB or color name)
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
						   			distance: number): Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRobotoBold;
	sprite.text = text;
	sprite.textAlign = "center";
	sprite.fontSize = 0.17;
	sprite.fontWeight = "bold";
	sprite.color = color;
	sprite.anchorX = "center";
	sprite.anchorY = "middle";

	// Rotate label to align to the bond
	rotateLabel(startPosition, endPosition, sprite.quaternion);

	// Compute the offset from the center of the bond
	const offset = new Vector3(0, 1, 0);
	offset.applyQuaternion(sprite.quaternion);
	offset.normalize().multiplyScalar(0.17);

	// Set center of label offset by the vector computed
	const pos = computeLabelPosition(startPosition, endPosition,
									 startRadius, endRadius, distance);
	sprite.position.set(pos[0]+offset.x, pos[1]+offset.y, pos[2]+offset.z);

	sprite.sync();

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

/**
 * Preload characters used by atoms' symbols and distance numbers
 */
export const preloadFonts = (): void => {

	preloadFont({
			font: localRobotoRegular,
			characters: "ABCDEFGHIKLMNOPRSTUVWXYZabcdefghiklmnorstuxyz"
		},
		() => log.info("Done preloading regular font")
	);
	preloadFont({
			font: localRobotoBold,
			characters: "0123456789."
		},
		() => log.info("Done preloading bold font")
	);
};
