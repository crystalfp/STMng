import * as THREE from "three";

interface TextSpriteOptions {
	fontFace: string;
	fontSize: number;
	borderThickness: number;
	borderColor: string;
	backgroundColor: string;
	textColor: string;
}

const defaultOptions: TextSpriteOptions = {
	fontFace: "Arial",
	fontSize: 18,
	borderThickness: 0,
	borderColor: "rgba(250,250,250,1)",
	backgroundColor: "rgba(255,255,255,1)",
	textColor: "rgba(255, 0, 0, 1.0)"
};
export const makeTextSprite = (message: string, parameters?: Partial<TextSpriteOptions>): THREE.Sprite => {

	const opt = parameters ? {...defaultOptions, ...parameters} : defaultOptions;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.font = `Bold ${opt.fontSize}px ${opt.fontFace}`;

    // Get size data (height depends only on font size)
    const metrics = context.measureText(message);
    const textWidth = metrics.width;
    canvas.width = textWidth * 10;
    canvas.height = opt.fontSize * 1.25 * 10;
    const ratio = canvas.height / canvas.width;

    // Set colors
    context.fillStyle = opt.backgroundColor;
    context.strokeStyle = opt.borderColor;
    context.fillStyle = opt.textColor;

	// Fill text
    context.fillText(message, opt.borderThickness, opt.fontSize + opt.borderThickness);

    // Canvas contents will be used for a texture
    const texture = new THREE.CanvasTexture(canvas);

    const spriteMaterial = new THREE.SpriteMaterial({map: texture});
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(ratio, 1, 1);
	sprite.position.set(0, 0, 0);

    return sprite;
};
