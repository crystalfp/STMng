/**
 * Render graphical output for Draw Unit Cell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-29
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
import {Group, Vector3, type Material, ConeGeometry, LineDashedMaterial,
		CylinderGeometry, MeshStandardMaterial, DoubleSide, Mesh,
		LineSegments, LineBasicMaterial, FrontSide,
		SphereGeometry} from "three";
import {computeCellEdges} from "@/services/ComputeCellEdges";
import {sm} from "@/services/SceneManager";
import {spriteText} from "@/services/SpriteText";
import {order3} from "@/services/SharedConstants";
import type {PositionType} from "@/types";

/**
 * Renderer for unit cell graphical output
 */
export class DrawUnitCellRenderer {

	private readonly outBV = new Group();
	private lineUC: LineSegments | undefined;
	private lineSC: LineSegments | undefined;
	private readonly nameUC;
	private readonly nameSC;
	private readonly nameBV;

	private readonly nameFUC;
	private readonly nameFSC;
	private readonly outFatUC = new Group();
	private readonly outFatSC = new Group();

	/**
	 * Build the renderer
	 *
	 * @param id - The corresponding node ID
	 */
	constructor(id: string) {

		// Prepare the names of the various graphical objects
		this.nameUC = "DrawUnitCell-" + id;
		this.nameSC = "DrawSupercell-" + id;
		this.nameBV = "DrawBasisVectors-" + id;
		this.nameFUC = "DrawFatUnitCell-" + id;
		this.nameFSC = "DrawFatSupercell-" + id;

		// Prepare the group for the base vectors and add it to the scene
		this.outBV.name = this.nameBV;
		sm.clearAndAddGroup(this.outBV);
		sm.clearGroup(this.nameBV);

		// Clear previous cell
		sm.deleteMesh(this.nameUC);
		sm.deleteMesh(this.nameSC);

		// Fat lines
		this.outFatUC.name = this.nameFUC;
		this.outFatSC.name = this.nameFSC;
		sm.clearAndAddGroup(this.outFatUC);
		sm.clearGroup(this.nameFUC);
		sm.clearAndAddGroup(this.outFatSC);
		sm.clearGroup(this.nameFSC);
	}

	/**
	 * Define the material to be used to draw the lines
	 *
	 * @param color - Color of the lines
	 * @param dashed - If the line should be dashed
	 * @returns The material to apply to the lines
	 */
	private static setMaterial(color: string, dashed: boolean): Material {

		return dashed ? new LineDashedMaterial({
						color,
						scale: 5,
						dashSize: 1,
						gapSize: 1,
					}) :
					new LineBasicMaterial({
						color
					});
	}

	/**
	 * Display the cell mesh (Unit Cell or Supercell)
	 *
	 * @param vertices - Vertices of the cell
	 * @param color - Color of the cell lines
	 * @param dashed - If the lines should be dashed
	 * @param visible - If the lines should be visible when created
	 * @param isSupercell - If the created cell is the supercell
	 */
	drawCell(vertices: number[],
			 color: string,
			 dashed: boolean,
			 visible: boolean,
			 isSupercell: boolean): void {

		const name = isSupercell ? this.nameSC : this.nameUC;

		// Clear previous cell
		sm.deleteMesh(name);
		sm.clearGroup(this.nameFSC);
		sm.clearGroup(this.nameFUC);

		// If no unit cell return
		if(vertices.length === 0) return;

		const edges = computeCellEdges(vertices);
		const line = new LineSegments(edges, DrawUnitCellRenderer.setMaterial(color, dashed));
		if(dashed) line.computeLineDistances();
		line.name = name;
        line.visible = visible;
        sm.add(line);
		sm.modified();
		sm.setUnitCellVisible(visible);

		if(isSupercell) this.lineSC = line;
		else this.lineUC = line;
	}

	/**
	 * Display the cell mesh as fat lines (Unit Cell or Supercell)
	 *
	 * @param vertices - Vertices of the cell
	 * @param color - Color of the cell lines
	 * @param visible - If the lines should be visible when created
	 * @param radius - Radius of the fat line
	 * @param isSupercell - If the created cell is the supercell
	 */
	drawFatCell(vertices: number[],
			 	color: string,
			 	visible: boolean,
				radius: number,
			 	isSupercell: boolean): void {

		const name = isSupercell ? this.nameFSC : this.nameFUC;

		// Clear previous cell
		sm.clearGroup(name);
		sm.deleteMesh(this.nameUC);
		sm.deleteMesh(this.nameSC);

		// If no unit cell return
		if(vertices.length === 0) return;

		const material = new MeshStandardMaterial({
			color,
			roughness: 0.5,
			metalness: 0.6,
			side: FrontSide,
		});

		const out = isSupercell ? this.outFatSC : this.outFatUC;

		// Add spheres on the corners
		for(let i=0; i < 24; i+=3) {

			const geometry = new SphereGeometry(radius);
			const sphere = new Mesh(geometry, material);
			sphere.position.set(vertices[i], vertices[i+1], vertices[i+2]);

			out.add(sphere);
		}

		// Add cylinders on the edges
		for(let i=0; i < 24; i+=2) {

			const i3 = order3[i];
			const j3 = order3[i+1];

			const dx = vertices[i3]   - vertices[j3];
			const dy = vertices[i3+1] - vertices[j3+1];
			const dz = vertices[i3+2] - vertices[j3+2];

			const len = Math.hypot(dx, dy, dz);

        	const geometry = new CylinderGeometry(radius, radius, len, 10, 1, true);
        	const cylinder = new Mesh(geometry, material);
			cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0),
												   new Vector3(dx/len, dy/len, dz/len));

			const midX = (vertices[i3]   + vertices[j3])/2;
			const midY = (vertices[i3+1] + vertices[j3+1])/2;
			const midZ = (vertices[i3+2] + vertices[j3+2])/2;
			cylinder.position.set(midX, midY, midZ);
			out.add(cylinder);
		}

		out.visible = visible;
	}

	/**
	* Create an arrow in the direction of the basis vector
	*
	* @param basis - Basis vector to be show
	* @param origin - Unit cell origin
	* @param size - Base size of the arrows
	* @param color - Color of the arrow and the label
	* @param axisLabel - Label on the vector
	* @param group - The arrow is added to this group
	*/
	private static basisVectorArrow(basis: Vector3, origin: Vector3, size: number,
									color: string, axisLabel: string, group: Group): void {

		const versor = basis.clone().normalize();
		const basisLen = basis.length();

		const coneSize = 2*size;
		const coneLen = 5*size;

		const material = new MeshStandardMaterial({
			color,
			roughness: 0.5,
			metalness: 0.6,
			side: DoubleSide
		});

		const cylinder = new Mesh(
			new CylinderGeometry(size, size, basisLen-coneLen, 10),
			material
		);

		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), versor);
		cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

		// Arrow tips
		const cone = new Mesh(
			new ConeGeometry(coneSize, coneLen, 10, 1),
			material
		);

		cone.quaternion.copy(cylinder.quaternion);
		cone.position.addVectors(basis, origin);
		cone.position.addScaledVector(versor, -coneLen/2);

		// Correlate label size to axis length for legibility
		const labelSize = 0.4 + 0.6*(basisLen-0.5)/19.5;

		// Label
		const labelPosition: PositionType = [
			basis.x+origin.x+versor.x*0.1,
			basis.y+origin.y+versor.y*0.1,
			basis.z+origin.z+versor.z*0.1
		];
		const sprite = spriteText(axisLabel, color, labelSize, labelPosition);

		group.add(cylinder, cone, sprite);
		sm.modified();
	}

	/**
	 * Draw the unit cell vectors
	 *
	 * @param visible - If the vectors are visible when created
	 * @param width - Line width. If zero the borders are rendered as lines
	 * @param vertices - Basis vectors and cell origin
	 * vertices[0-8] are the basis; vertices[9-11] the origin
	 */
	drawBasisVectors(visible: boolean, width: number, vertices: number[]): void {

		// Clear basis vectors
		sm.clearGroup(this.nameBV);

		// No vertices or not visible, nothing to do
		if(vertices.length === 0 || !visible) return;

		// Basis vectors visible, create them
		const originZero = new Vector3(vertices[9], vertices[10], vertices[11]);

		const basisA = new Vector3(vertices[0], vertices[1], vertices[2]);
		const basisB = new Vector3(vertices[3], vertices[4], vertices[5]);
		const basisC = new Vector3(vertices[6], vertices[7], vertices[8]);

		// Find the size of the arrows related to the longest axis
		if(width === 0) {
			const la = basisA.length();
			const lb = basisB.length();
			const lc = basisC.length();
			const ltot = Math.max(la, lb, lc);
			width = Math.max(0.05, ltot/300);
		}

		DrawUnitCellRenderer.basisVectorArrow(basisA, originZero, width, "#FF0000", "a", this.outBV);
		DrawUnitCellRenderer.basisVectorArrow(basisB, originZero, width, "#79FF00", "b", this.outBV);
		DrawUnitCellRenderer.basisVectorArrow(basisC, originZero, width, "#0000FF", "c", this.outBV);

		this.outBV.visible = visible;
		sm.modified();
	}

	/**
	 * Change the appearance of the cell and supercell lines
	 *
	 * @param colorUC - Color for the unit cell lines
	 * @param dashedUC - If the unit cell lines are dashed
	 * @param colorSC - Color for the supercell lines
	 * @param dashedSC - If the supercell lines are dashed
	 */
	changeMaterials(colorUC: string, dashedUC: boolean, colorSC: string, dashedSC: boolean): void {

		if(this.lineSC) {
			this.lineSC.material = DrawUnitCellRenderer.setMaterial(colorSC, dashedSC);
			if(dashedSC) this.lineSC.computeLineDistances();
		}
		if(this.lineUC) {
			this.lineUC.material = DrawUnitCellRenderer.setMaterial(colorUC, dashedUC);
			if(dashedUC) this.lineUC.computeLineDistances();
		}
		if(this.outFatUC) {

			const material = new MeshStandardMaterial({
				color: colorUC,
				roughness: 0.5,
				metalness: 0.6,
				side: FrontSide,
			});

			this.outFatUC.traverse((object) => {
				if(object.type !== "Mesh") return;
				(object as Mesh).material = material;
			});
		}
		if(this.outFatSC) {

			const material = new MeshStandardMaterial({
				color: colorSC,
				roughness: 0.5,
				metalness: 0.6,
				side: FrontSide,
			});

			this.outFatSC.traverse((object) => {
				if(object.type !== "Mesh") return;
				(object as Mesh).material = material;
			});
		}
		sm.modified();
	}

	/**
	 * Change visibility of cells and basis vectors
	 *
	 * @param showUnitCell - If the unit cell should be visible
	 * @param showSupercell - If the supercell should be visible
	 * @param showBasisVectors - If the basis vectors should be visible
	 */
	setVisibility(showUnitCell: boolean, showSupercell: boolean, showBasisVectors: boolean): void {

		if(this.lineUC) this.lineUC.visible = showUnitCell;
		if(this.lineSC) this.lineSC.visible = showSupercell;
		if(this.outFatUC) this.outFatUC.visible = showUnitCell;
		if(this.outFatSC) this.outFatSC.visible = showSupercell;
		if(this.outBV) this.outBV.visible = showBasisVectors;
		sm.modified();
		sm.setUnitCellVisible(showUnitCell);
	}
}
