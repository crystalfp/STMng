/**
 * Render graphical output for Protein backbone structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-03-03
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
import {Group, CatmullRomCurve3, Vector3, TubeGeometry, Mesh,
		MeshStandardMaterial, DoubleSide, IcosahedronGeometry} from "three";
import {sm} from "@/services/SceneManager";

/**
 * Renderer for backbone graphical output
 */
export class StructureBackboneRenderer {

	private readonly name;
	private readonly group = new Group();
	private readonly colors: string[] = ["#1b9e77", "#d95f02", "#7570b3",
										 "#e7298a", "#66a61e", "#e6ab02", "#a6761d"];

	/**
	 * Initialize the renderer
	 *
	 * @param id - Node id
	 */
	constructor(id: string) {

		this.name = "StructureBackbone-" + id;
		this.group.name = this.name;
		sm.clearAndAddGroup(this.group);
	}

	/**
	 * Draw a tube through the given points
	 *
	 * @param coordinates - Coordinates of the selected atoms
	 * @param chainStart - Start index of each chain. There is an entry more
	 * 					   so indices chains are (i, i+1)
	 * @param tubeRadius - Radius of the tube representing the chain
	 * @param visible - If the tube should be visible
	 */
	drawChains(coordinates: number[],
			   chainStart: number[],
			   tubeRadius: number,
			   visible: boolean): void {

		// Remove existing tubes
		sm.clearGroup(this.name);

		if(!coordinates?.length || !visible) return;

		const len = chainStart.length;
		for(let i=0; i < len-1; ++i) {

			if(chainStart[i] === chainStart[i+1]) continue;

			const nodes: Vector3[] = [];
			for(let k=chainStart[i]*3; k < chainStart[i+1]*3; k+=3) {
				nodes.push(new Vector3(coordinates[k], coordinates[k+1], coordinates[k+2]));
			}
			const curve = new CatmullRomCurve3(nodes);
			const npoints = 30*(chainStart[i+1]-chainStart[i]);
			const geometry = new TubeGeometry(curve, npoints, tubeRadius, 16, false);

			const color = this.colors[i % this.colors.length];
			const material = new MeshStandardMaterial({
				color,
				roughness: 0.5,
				metalness: 0.6,
				side: DoubleSide
			});
			const mesh = new Mesh(geometry, material);
			this.group.add(mesh);

			const top1 = new IcosahedronGeometry(tubeRadius, 9);
			let k = chainStart[i]*3;
			top1.translate(coordinates[k], coordinates[k+1], coordinates[k+2]);
			const mesh1 = new Mesh(top1, material);
			this.group.add(mesh1);

			const top2 = new IcosahedronGeometry(tubeRadius, 9);
			k = (chainStart[i+1]-1)*3;
			top2.translate(coordinates[k], coordinates[k+1], coordinates[k+2]);
			const mesh2 = new Mesh(top2, material);
			this.group.add(mesh2);
		}
	}
}
