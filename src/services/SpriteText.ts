/**
 * Transform a text into a 3D object to be added to the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-17
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
import log from "electron-log";
import {type Group, type Mesh, Vector3, type Quaternion, type Camera} from "three";
import {Text as TroikaText, preloadFont, BatchedText} from "troika-three-text";
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
						   size: number,
						   position: PositionType): Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRobotoRegular;
	sprite.text = text;
	sprite.textAlign = "center";
	sprite.fontSize = size;
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
	sprite.fontSize = 0.25;
	sprite.fontWeight = "bold";
	sprite.color = color;
	sprite.anchorX = "center";
	sprite.anchorY = "middle";

	// Rotate label to align to the bond
	rotateLabel(startPosition, endPosition, sprite.quaternion);

	// Compute the offset from the center of the bond
	const offset = new Vector3(0, 1, 0);
	offset.applyQuaternion(sprite.quaternion);
	offset.normalize().multiplyScalar(sprite.fontSize);

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
		() => {log.debug("Done preloading regular font");}
	);
	preloadFont({
			font: localRobotoBold,
			characters: "0123456789."
		},
		() => {log.debug("Done preloading bold font");}
	);
};

/**
 * BatchedText with billboard labels
 * Usage: add Text with `billboardBatchedText.addText(text)`
 */
export class BillboardBatchedText extends BatchedText {

	/**
	 * Update the text rotation every frame to face the camera
	 *
	 * @param camera - Camera to be used for the text size attenuation
	 */
  	override update(camera: Camera): void {

		for(const text of this._members.keys()) {

      		camera.getWorldQuaternion(text.quaternion);
    	}
  	}
}
