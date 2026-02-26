/**
 * Render graphical output for Measures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-12-01
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {Group, IcosahedronGeometry, PointsMaterial, Points, type Mesh, type MeshLambertMaterial,
		Color, type ColorRepresentation, type TypedArray} from "three";
import {sm} from "@/services/SceneManager";
import {spriteTextAlongBond} from "@/services/SpriteText";
import type {BondData, CtrlParams, SelectedAtom} from "@/types";

/**
 * Renderer for measures graphical output
 */
export class MeasuresRenderer {

	private readonly group = new Group();
	private readonly groupName;

	/**
	 * Build the renderer
	 *
	 * @param id - The corresponding node ID
	 */
	constructor(id: string) {

		// Prepare the output group
		this.groupName = "AtomSelectors-" + id;
		this.group.name = this.groupName;
		sm.clearAndAddGroup(this.group);
	}

	/**
	 * Clear the output
	 */
	clearOutput(): void {
		sm.clearGroup(this.groupName);
	}

	/**
	 * Measures bonds from the selected atom
	 *
	 * @param params - Params from askNode "bonds"
	 * @param bondDataTable - Table of bonds data
	 * @param pointSize - Point size for the selected atom mark
	 */
	measureBonds(params: CtrlParams, bondDataTable: BondData[], pointSize: number): void {

		sm.clearGroup(this.groupName);

		const radius = params.radius as number ?? 0;
		if(radius === 0) return;
		const x = params.x as number ?? 0;
		const y = params.y as number ?? 0;
		const z = params.z as number ?? 0;
		const color = params.color as string ?? "red";

		for(const bd of bondDataTable) {

			const label = spriteTextAlongBond(bd.distance.toFixed(3), "yellow", [x, y, z],
											  bd.atomPosition, radius*0.5, bd.radius*0.5, bd.distance);
			this.group.add(label);
		}

		const subdivisions = radius > 0.5 ? 4 : 1;
		const geom = new IcosahedronGeometry(radius*0.6, subdivisions);
		const mat = new PointsMaterial({color, size: pointSize});
		const points = new Points(geom, mat);
		points.position.set(x, y, z);
		this.group.add(points);
		sm.modified();
	}

	/**
	 * Show atoms measurements
	 *
	 * @param details - Selected atoms details
	 * @param pointSize - Point size for the selected atom mark
	 */
	measureAtoms(details: SelectedAtom[], pointSize: number): void {

		sm.clearGroup(this.groupName);

        for(const detail of details) {
            const subdivisions = detail.radius > 0.5 ? 4 : 1;
            const geom = new IcosahedronGeometry(detail.radius*0.6, subdivisions);
            const mat = new PointsMaterial({color: detail.color, size: pointSize});
            const points = new Points(geom, mat);
            points.position.set(detail.position[0], detail.position[1], detail.position[2]);
            this.group.add(points);
        }
	}

	/**
	 * Compute the polyhedron volume using the formula found here:
	 * https://mathworld.wolfram.com/PolyhedronVolume.html
	 *
	 * @param vertices - Polyhedron geometry vertices coordinates.
	 *					 Each three consecutive vertices form a triangle
	 * @param numberVertices - Total number of vertices
	 * @returns The polyhedron volume
	 */
	private static computeVolume(vertices: TypedArray, numberVertices: number): number {

		let computedVolume = 0;
		for(let i=0; i < numberVertices/3; ++i) {

			const startIdx = i*9;

			const vu = [
				vertices[startIdx+3] - vertices[startIdx],
				vertices[startIdx+4] - vertices[startIdx+1],
				vertices[startIdx+5] - vertices[startIdx+2]
			];
			const vv = [
				vertices[startIdx+6] - vertices[startIdx],
				vertices[startIdx+7] - vertices[startIdx+1],
				vertices[startIdx+8] - vertices[startIdx+2]
			];
			const normal = [
				vu[1] * vv[2] - vu[2] * vv[1],
				vu[2] * vv[0] - vu[0] * vv[2],
				vu[0] * vv[1] - vu[1] * vv[0]
			];

			computedVolume += vertices[startIdx]*normal[0] +
							  vertices[startIdx+1]*normal[1] +
							  vertices[startIdx+2]*normal[2];
		}

		// Compute volume
		return computedVolume/6;
	}

	private objectCurrent: Mesh | undefined;
	private objectNew: Mesh | undefined;

	/**
	 * Select the polyhedra
	 *
	 * @param idxNew - Index of the selected polyhedra
	 * @param idxCurrent - Index of the previously selected polyhedra
	 */
	selectPolyhedra(idxNew: number | undefined, idxCurrent: number | undefined): void {

		sm.traverse((object) => {
			if(object.name === "Polyhedron") {
				if(object.userData.idx === idxNew) {
					this.objectNew = object as Mesh;
				}
				if(object.userData.idx === idxCurrent) {
					this.objectCurrent = object as Mesh;
				}
			}
		});
	}

	/**
	 * Set polyhedra color
	 *
	 * @param color - Color for the current polyhedra
	 */
	setCurrentPolyhedraColor(color: ColorRepresentation): void {

        (this.objectCurrent!.material as MeshLambertMaterial).color = new Color(color);
	}

	/**
	 * Mark the selected polyhedra
	 */
	markPolyhedra(): void {

		(this.objectNew!.material as MeshLambertMaterial).color = new Color("#FF0000");
	}

	/**
	 * Get the selected polyhedra volume
	 *
	 * @returns return the selected polyhedra volume
	 */
	getPolyhedraVolume(): number {

        const positions = this.objectNew!.geometry.getAttribute("position");
        return MeasuresRenderer.computeVolume(positions.array, positions.count);
	}
}
