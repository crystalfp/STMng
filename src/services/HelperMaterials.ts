/**
 * Compute materials.
 * @remarks The color interpolated bonds should be implemented
 *			(an idea is in the commented part).
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import * as THREE from "three";

/**
 * Compute surface material
 *
 * @param color - Color of the surface
 * @param roughness - Rugosity of the material
 * @param metalness - Metal shining of the material
 * @returns The mesh material
 */
export const normalMaterial = (color: THREE.ColorRepresentation,
						       roughness: number,
							   metalness: number): THREE.MeshStandardMaterial =>
	new THREE.MeshStandardMaterial({
		color,
		roughness,
		metalness,
		side: THREE.FrontSide,
	});

/**
 * Compute material that interpolates between two colors
 *
 * @param colorFrom - First side color
 * @param colorTo - End side color
 * @param roughness - Rugosity of the material
 * @param metalness - Metal shining of the material
 * @param width - of the surface
 * @returns Material to apply
 */
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

/*
export const dashedLineMaterialShader = (color: THREE.ColorRepresentation): THREE.ShaderMaterial => {

	const cc = new THREE.Color(color);

	const vpSize = [window.innerWidth, window.innerHeight];

	const uniforms = {
		u_resolution: {type: "v2", value: {x: vpSize[0], y: vpSize[1]}},
		u_dashSize : {type:"f", value: 10.0},
		u_gapSize : {type:"f", value: 5.0},
		u_color : {type: "v3", value: {x: cc.r, y: cc.g, z: cc.b}}
	};

	const vertexShader = `
flat out vec3 startPos;
out vec3 vertPos;

void main() {
	vec4 pos    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_Position = pos;
	vertPos     = pos.xyz / pos.w;
	startPos    = vertPos;
}`;

	const fragmentShader = `
precision highp float;

flat in vec3 startPos;
in vec3 vertPos;

uniform vec3  u_color;
uniform vec2  u_resolution;
uniform float u_dashSize;
uniform float u_gapSize;

void main(){

	vec2  dir  = (vertPos.xy-startPos.xy) * u_resolution.xy/2.0;
	float dist = length(dir);

	if (fract(dist / (u_dashSize + u_gapSize)) > u_dashSize/(u_dashSize + u_gapSize))
		discard;
	gl_FragColor = vec4(u_color.rgb, 1.0);
}`;

	return new THREE.ShaderMaterial({
		uniforms,
		vertexShader,
		fragmentShader
	});
};
*/
