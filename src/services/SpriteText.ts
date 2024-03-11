/**
 * Transform a text into a 3D object to be added to the scene.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import type {PositionType} from "@/types";

/**
 * Create a text sprite
 *
 * @param text - The text to display
 * @param color - Color of the text (as #RRGGBB)
 * @param position - Position of the label
 * @param offset - If present gives the offset respect to position
 * @returns The sprite to be added to the scene
 */
export const spriteText = (text: string, color: string,
						   position: PositionType, offset?: PositionType): THREE.Sprite => {

	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext("2d")!;
	ctx.font = "bold 36pt Roboto";
	ctx.fillStyle = color;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(text, 128, 128);
	const tex = new THREE.Texture(canvas);
	tex.needsUpdate = true;
	// tex.minFilter = THREE.LinearFilter;
    // tex.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex}));
	if(offset) {
		sprite.position.set(position[0]+offset[0], position[1]+offset[1], position[2]+offset[2]);
	}
	else {
		sprite.position.set(position[0], position[1], position[2]);
	}

	return sprite;
};
