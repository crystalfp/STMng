/**
 * Transform a text into a 3D object to be added to the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-17
 */
import * as THREE from "three";
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
						   offset?: PositionType): THREE.Mesh => {

	const sprite = new TroikaText();

	sprite.font = localRoboto;
	sprite.text = text;
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
 * Dispose labels contained in a group
 *
 * @param group - Group containing Text meshes
 */
export const disposeTextInGroup = (group: THREE.Group): void => {

	const labelsToDelete: TroikaText[] = [];
	group.traverse((obj) => {

		if(obj.type === "Mesh") labelsToDelete.push(obj as TroikaText);
	});
	for(const obj of labelsToDelete) {
		group.remove(obj);
		obj.dispose();
	}
};
