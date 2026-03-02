/**
 * Render graphical output for Slice Structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-04-10
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
import {Group, SphereGeometry, MeshLambertMaterial, DoubleSide,
		Mesh, BufferGeometry, Float32BufferAttribute} from "three";
import {sm} from "@/services/SceneManager";

/**
 * Renderer for polyhedra graphical output
 */
export class SliceStructureRenderer {

	private readonly name: string;
	private readonly group: Group = new Group();
	private readonly material = new MeshLambertMaterial({
		color: "#FFFFFF",
		opacity: 0.5,
		side: DoubleSide,
		transparent: true
	});

	/**
	 * Create the renderer
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {

		// Prepare the names of the various graphical objects
		this.name = "SliceStructure-" + id;
		this.group.name = this.name;
		sm.clearAndAddGroup(this.group);
		sm.clearGroup(this.name);
	}

	/**
	 * Render spheres
	 *
	 * @param centers - List of center coordinates of the various spheres
	 * @param radius - Radius of the spheres
	 * @param visible - Visibility of the spheres
	 */
	drawSpheres(centers: number[], radius: number, visible: boolean): void {

		sm.clearGroup(this.name);
		const len = centers?.length ?? 0;
		if(len < 3) return;

		for(let i=0; i < len; i += 3) {
			const sphere = new Mesh(new SphereGeometry(radius, 32, 32), this.material);
			sphere.position.set(centers[i], centers[i+1], centers[i+2]);
			this.group.add(sphere);
		}
		this.group.visible = visible;
		sm.modified();
	}

	/**
	 * Draw the polygon intersection of the plane with the unit cell
	 *
	 * @param vertices - Vertices of the polygon intersection of the plane with the unit cell
	 * @param visible - Visibility of the plane
	 * @param doNotClear - Don't clear the existing plane before adding this one
	 */
	drawIntersectedPlane(vertices: number[], visible: boolean, doNotClear=false): void {

		if(!doNotClear) sm.clearGroup(this.name);
		if(!vertices) return;
		const nVertices = vertices.length/3;
		if(nVertices < 3) return;

		const indices = [];
		for(let i=2; i < nVertices; ++i) {
			indices.push(0, i-1, i);
		}

		const geometry = new BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

		const polygon = new Mesh(geometry, this.material);
		this.group.add(polygon);
		this.group.visible = visible;
		sm.modified();
	}

	/**
	 * Set visibility
	 *
	 * @param visible - Visibility of the group
	 */
	setVisibility(visible: boolean): void {

		this.group.visible = visible;
		sm.modified();
	}
}
