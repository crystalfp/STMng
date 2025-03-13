import {Group, InstancedMesh, Matrix4, Quaternion, Vector3} from "three";
import type {PositionType} from "@/types";

/**
 * Cache the atoms' sphere geometries
 */
export class SpheresCacheNew {

	private readonly geometry: IcosahedronGeometry;
	private readonly sphereSubdivisions = [0, 0, 1,  3,  9];
	private readonly subdivisions;
	private readonly drawRoughness: number;
	private readonly drawMetalness: number;
	private readonly scales: number[] = [];
	private readonly centers: number[][] = [];
	private readonly atomMap = new Map<string, number[]>();
	private index = 0;

	/**
	 * Initialize the spheres cache
	 *
	 * @param drawQuality - Rendering quality (1-4)
	 * @param drawRoughness - Surface roughness (0-1)
	 * @param drawMetalness - Surface metalness (0-1)
	 */
	constructor(drawQuality: number, drawRoughness: number, drawMetalness: number) {

		this.subdivisions = this.sphereSubdivisions[drawQuality];
		this.drawRoughness = drawRoughness;
		this.drawMetalness = drawMetalness;
		this.geometry = new IcosahedronGeometry(1, this.subdivisions);
	}

	addSphere(center: PositionType, radius: number, color: string): void {

		const atomList = this.atomMap.get(color);
		this.atomMap.set(color, atomList ? [...atomList, this.index] : [this.index]);

		this.centers.push(center);
		this.scales.push(radius);

		++this.index;
	}

	/**
	 * Render the spheres
	 *
	 * @param group - The output group where to add the spheres
	 */
	renderSpheres(group: Group): void {

		// Remove previous meshes
		const meshes: Mesh[] = [];
		group.traverse((child) => {
			if(child.type === "Mesh") meshes.push(child as Mesh);
		});
		for(const mesh of meshes) {
			mesh.geometry.dispose();
			(mesh.material as MeshStandardMaterial).dispose();
			group.remove(mesh);
		}

		// For each cached sphere type
		for(const entry of this.atomMap.entries()) {

			const indices = entry[1];

			const count = indices.length;

			const meshMaterial = new MeshStandardMaterial({
				color: entry[0],
				roughness: this.drawRoughness,
				metalness: this.drawMetalness,
				side: FrontSide,
			});
			const sphere = new InstancedMesh(this.geometry, meshMaterial, count);
			sphere.frustumCulled = false;
			group.add(sphere);

			// For each instance of the mesh, position it
			const position = new Vector3();
			const quaternion = new Quaternion();
			quaternion.identity();
			const scale = new Vector3();
			const matrix = new Matrix4();
			for(let i=0; i < count; ++i) {

				const idx = indices[i];

				scale.setScalar(this.scales[idx]);
				position.set(this.centers[idx][0],
							 this.centers[idx][1],
							 this.centers[idx][2]);
				matrix.compose(position, quaternion, scale);
				sphere.setMatrixAt(i, matrix);
			}
		}
	}
}

	// const spheresCache = new SpheresCacheNew(this.drawQuality,
	// 										 this.drawRoughness,
	// 						  				 this.drawMetalness);

		// let radius = 1;
		// switch(drawKind) {
		// 	case "ball-and-stick":
		// 		radius = atom.rCov*rCovScale;
		// 		break;
		// 	case "van-der-waals":
		// 		radius = atom.rVdW;
		// 		break;
		// }
		// spheresCache.addSphere(position, radius, atom.color);
	// spheresCache.renderSpheres(this.atomsGroup);
				