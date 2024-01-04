import * as THREE from "three";

export const normalMaterial = (color: THREE.ColorRepresentation,
						       roughness: number,
							   metalness: number): THREE.MeshStandardMaterial => {

	return new THREE.MeshStandardMaterial({
		color,
		roughness,
		metalness,
		side: THREE.FrontSide,
	});
};

export const colorTextureMaterial = (colorFrom: THREE.Color,
									colorTo: THREE.Color,
									roughness: number, metalness: number,
									width: number): THREE.Material => {

	const height = 2;
	const size = width * height;
	const data = new Uint8Array(4 * size);

	const rf = Math.floor(colorFrom.r * 255);
	const gf = Math.floor(colorFrom.g * 255);
	const bf = Math.floor(colorFrom.b * 255);

	for(let i = 0; i < width; ++i) {
		const stride = i * 4;
		data[stride] = rf;
		data[stride + 1] = gf;
		data[stride + 2] = bf;
		data[stride + 3] = 255;
	}

	const rt = Math.floor(colorTo.r * 255);
	const gt = Math.floor(colorTo.g * 255);
	const bt = Math.floor(colorTo.b * 255);
	for(let i = width; i < size; ++i) {
		const stride = i * 4;
		data[stride] = rt;
		data[stride + 1] = gt;
		data[stride + 2] = bt;
		data[stride + 3] = 255;
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
