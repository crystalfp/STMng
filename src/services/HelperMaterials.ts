/**
 * Compute materials.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-01
 */
import * as THREE from "three";

/**
 * Compute material that interpolates between two colors
 *
 * @param colorFrom - First side color
 * @param colorTo - End side color
 * @param roughness - Rugosity of the material
 * @param metalness - Metal shining of the material
 * @param width - Width of the surface
 * @param shaded - If true bonds have a linear color interpolation, else have two color areas
 * @returns Material to apply
 */
export const colorTextureMaterial = (colorFrom: THREE.Color,
									 colorTo: THREE.Color,
									 roughness: number,
									 metalness: number,
									 width: number,
									 shaded: boolean): THREE.Material => {

	const height = shaded ? 32 : 2;
	const size = width * height;
	const data = new Uint8Array(4 * size);

	const rf = Math.floor(colorFrom.r * 255);
	const gf = Math.floor(colorFrom.g * 255);
	const bf = Math.floor(colorFrom.b * 255);

	const rt = Math.floor(colorTo.r * 255);
	const gt = Math.floor(colorTo.g * 255);
	const bt = Math.floor(colorTo.b * 255);

	for(let h = 0; h < height; ++h) {

		const tt = h/(height-1);
		const tf = 1-tt;

		for(let i = 0; i < width; ++i) {
			const stride = (h*width+i)*4;
			data[stride]   = rf*tf+rt*tt;
			data[stride+1] = gf*tf+gt*tt;
			data[stride+2] = bf*tf+bt*tt;
			data[stride+3] = 255;
		}
	}

	// Use the buffer to create a DataTexture
	const texture = new THREE.DataTexture(data, width, height);
	texture.needsUpdate = true;

	return new THREE.MeshStandardMaterial({
		roughness,
		metalness,
		side: THREE.FrontSide,
		map: texture
	});
};
