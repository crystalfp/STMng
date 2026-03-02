/**
 * Caching cylinders.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-03-12
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
import {Color, CylinderGeometry, InstancedMesh, type Material, Matrix4,
		type Mesh, Quaternion, Vector3, type Group} from "three";
import {colorTextureMaterial} from "./HelperMaterials";
import type {PositionType} from "@/types";

/**
 * A logical cache for the cylinder instances to be created
 */
export class CylinderCache {

	private readonly geometry: CylinderGeometry;
	private readonly shadedBonds;
	private readonly subdivisions;
	private readonly drawRoughness: number;
	private readonly drawMetalness: number;
	private readonly radiusScales: number[] = [];
	private readonly scales: number[] = [];
	private readonly centers: number[][] = [];
	private readonly rotations: Quaternion[] = [];
	private readonly colors = new Map<string, number[]>();
	private index = 0;

	/**
	 * Initialize the cylinder bond cache
	 *
	 * @param radius - Radius of the bond
	 * @param shadedBonds - If the bond color is shaded or in two bands
	 * @param subdivisions - Number of cylinder sides based on rendering quality
	 * @param drawRoughness - Surface roughness (0-1)
	 * @param drawMetalness - Surface metalness (0-1)
	 */
	constructor(radius: number, shadedBonds: boolean,
				subdivisions: number, drawRoughness: number, drawMetalness: number) {

		this.shadedBonds = shadedBonds;
		this.subdivisions = subdivisions;
		this.drawRoughness = drawRoughness;
		this.drawMetalness = drawMetalness;

		this.geometry = new CylinderGeometry(radius, radius, 1, subdivisions, 1, true);
	}

	/**
	 * Add a cylinder bond
	 *
	 * @param start - Position of the bond start
	 * @param end - Position of the bond end
	 * @param colorStart - Color of the bond start
	 * @param colorEnd - Color of the bond end
	 * @param radiusScale - Scaling the radius of the cylinder
	 */
	addCylinder(start: PositionType, end: PositionType,
				colorStart: string, colorEnd: string,
			    radiusScale=1): void {

		// Save the cylinder colors
		const color = `${colorStart}-${colorEnd}`;
		const colorList = this.colors.get(color);
		this.colors.set(color, colorList ? [...colorList, this.index] : [this.index]);

		// Cylinder length
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const dz = end[2] - start[2];
		const len = Math.hypot(dx, dy, dz);

		// Cylinder center point
		const center = [
			(start[0] + end[0])/2,
			(start[1] + end[1])/2,
			(start[2] + end[2])/2,
		];

		// Cylinder rotation
		const quaternion = new Quaternion();
		quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(dx/len, dy/len, dz/len));

		// Save the cylinder data
		this.radiusScales.push(radiusScale);
		this.scales.push(len);
		this.centers.push(center);
		this.rotations.push(quaternion);
		++this.index;
	}

	/**
	 * Render the cylinder bonds
	 *
	 * @param group - The output group where to add the bond
	 */
	renderCylinders(group: Group): void {

		// Remove previous meshes
		const meshes: Mesh[] = [];
		group.traverse((child) => {
			if(child.type === "Mesh") meshes.push(child as Mesh);
		});
		for(const mesh of meshes) {
			mesh.geometry.dispose();
			(mesh.material as Material).dispose();
			group.remove(mesh);
		}

		// For positioning of the cylinders
		const position = new Vector3();
		const quaternion = new Quaternion();
		const scale = new Vector3();
		const matrix = new Matrix4();

		// For each cached cylinder type
		for(const entry of this.colors.entries()) {

			const colors = entry[0].split("-");

			const meshMaterial = colorTextureMaterial(new Color(colors[0]),
													  new Color(colors[1]),
													  this.drawRoughness,
													  this.drawMetalness,
													  this.subdivisions,
													  this.shadedBonds);
			const indices = entry[1];
			const count = indices.length;

			const cylinder = new InstancedMesh(this.geometry, meshMaterial, count);
			cylinder.frustumCulled = false;
			group.add(cylinder);

			// For each instance of the mesh, position it
			for(let i=0; i < count; ++i) {

				const idx = indices[i];

				const radiusScale = this.radiusScales[idx];
				scale.set(radiusScale, this.scales[idx], radiusScale);
				position.set(this.centers[idx][0],
							 this.centers[idx][1],
							 this.centers[idx][2]);
				quaternion.copy(this.rotations[idx]);
				matrix.compose(position, quaternion, scale);
				cylinder.setMatrixAt(i, matrix);
			}
		}
	}
}
