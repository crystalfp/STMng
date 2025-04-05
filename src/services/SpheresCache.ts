/**
 * Cache the atoms' sphere geometries
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-06
 */
import {IcosahedronGeometry, MeshStandardMaterial, FrontSide, type Mesh,
		type Group, InstancedMesh, Matrix4, Quaternion, Vector3} from "three";
import type {PositionType} from "@/types";

/**
 * Cache the atoms' sphere geometries
 */
export class SpheresCache {

	private readonly geometry: IcosahedronGeometry;
	private readonly drawRoughness: number;
	private readonly drawMetalness: number;
	private readonly scales: number[] = [];
	private readonly centers: number[][] = [];
	private readonly atomMap = new Map<string, number[]>();
	private index = 0;
	private readonly mapIndexAtom: number[][] = [];

	/**
	 * Initialize the spheres cache
	 *
	 * @param subdivisions - Number of icosahedron sides based on rendering quality
	 * @param drawRoughness - Surface roughness (0-1)
	 * @param drawMetalness - Surface metalness (0-1)
	 */
	constructor(subdivisions: number, drawRoughness: number, drawMetalness: number) {

		this.drawRoughness = drawRoughness;
		this.drawMetalness = drawMetalness;
		this.geometry = new IcosahedronGeometry(1, subdivisions);
	}

	/**
	 * Add a sphere to be rendered
	 *
	 * @param center - Center of the added sphere
	 * @param radius - Its radius
	 * @param color - Its color
	 */
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

		// For positioning of the spheres
		const position = new Vector3();
		const quaternion = new Quaternion();
		const scale = new Vector3();
		const matrix = new Matrix4();

		// For each cached sphere type
		let index = 0;
		for(const entry of this.atomMap.entries()) {

			const indices = entry[1];
			const count = indices.length;

			const meshMaterial = new MeshStandardMaterial({
				color: entry[0],
				roughness: this.drawRoughness,
				metalness: this.drawMetalness,
				side: FrontSide,
			});
			meshMaterial.color.convertSRGBToLinear();
			const sphere = new InstancedMesh(this.geometry, meshMaterial, count);
			sphere.frustumCulled = false;
			sphere.name = "Atom";
			sphere.userData = {index};

			group.add(sphere);

			// For each instance of the mesh, position it
			for(let i=0; i < count; ++i) {

				const idx = indices[i];

				scale.setScalar(this.scales[idx]);
				position.set(this.centers[idx][0],
							 this.centers[idx][1],
							 this.centers[idx][2]);
				matrix.compose(position, quaternion, scale);
				sphere.setMatrixAt(i, matrix);
			}

			// Save the mapping (needed for interactively select atoms)
			const out = Array<number>(count).fill(0);
			for(let i=0; i < count; ++i) out[i] = indices[i];
			this.mapIndexAtom[index] = out;

			++index;
		}
	}

	/**
	 * Return the atom mapping
	 *
	 * @returns The map from the pair mesh index/instance index to atom index
	 */
	returnAtomsMap(): number[][] {
		return this.mapIndexAtom;
	}
}
