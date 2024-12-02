/**
 * Render graphical output for Draw Unit Cell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-29
 */
import * as THREE from "three";
import {sm} from "@/services/SceneManager";
import {spriteText} from "@/services/SpriteText";
import type {PositionType} from "@/types";

// Triangles. Top and bottom facies are not needed
const indices = [
    // 0, 1, 2,
    // 0, 2, 3,

    4, 5, 1,
    4, 1, 0,

    3, 2, 6,
    3, 6, 7,

    4, 0, 3,
    4, 3, 7,

    1, 5, 6,
    1, 6, 2,

    // 5, 4, 7,
    // 5, 7, 6,
];

export class DrawUnitCellRenderer {

	private readonly outBV = new THREE.Group();
	private lineUC: THREE.LineSegments | undefined;
	private lineSC: THREE.LineSegments | undefined;
	private readonly nameUC;
	private readonly nameSC;
	private readonly nameBV;

	constructor(private readonly id: string) {

		// Prepare the names of the various graphical objects
		this.nameUC = "DrawUnitCell-" + this.id;
		this.nameSC = "DrawSupercell-" + this.id;
		this.nameBV = "DrawBasisVectors-" + this.id;

		// Prepare the group for the base vectors and add it to the scene
		this.outBV.name = this.nameBV;
		sm.clearAndAddGroup(this.outBV);
		sm.clearGroup(this.nameBV);
	}

	/**
	 * Define the material to be used to draw the lines
	 *
	 * @param color - Color of the lines
	 * @param dashed - If the line should be dashed
	 * @returns The material to apply to the lines
	 */
	private setMaterial(color: string, dashed: boolean): THREE.Material {

		// eslint-disable-next-line sonarjs/no-selector-parameter
		return dashed ? new THREE.LineDashedMaterial({
						color,
						scale: 5,
						dashSize: 1,
						gapSize: 1,
					}) :
					new THREE.LineBasicMaterial({
						color
					});
	}

	/**
	 * Display the cell mesh (Unit Cell or Supercell)
	 *
	 * @param vertices - vertices of the cell
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

		// If no unit cell return
		if(vertices.length === 0) return;

		const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
		const edges = new THREE.EdgesGeometry(geometry);

		const line = new THREE.LineSegments(edges, this.setMaterial(color, dashed));
		if(dashed) line.computeLineDistances();
		line.name = name;
        line.visible = visible;
        sm.add(line);
		sm.modified();

		if(isSupercell) this.lineSC = line;
		else this.lineUC = line;
	}

	/**
	 * From a direction extract needed rotation
	 *
	 * @param versor - Direction versor
	 * @param quaternion - Resulting rotation quaternion
	 */
	private setDirection(versor: THREE.Vector3, quaternion: THREE.Quaternion): void {

		// Versor is assumed to be normalized
		if(versor.y > 0.99999) quaternion.set(0, 0, 0, 1);
		else if(versor.y < -0.99999) quaternion.set(1, 0, 0, 0);
		else {
			const rotationAxis = new THREE.Vector3(versor.z, 0, -versor.x).normalize();
			const radians = Math.acos(versor.y);
			quaternion.setFromAxisAngle(rotationAxis, radians);
		}
	}

	/**
	* Create an arrow in the direction of the basis vector
	*
	* @param basis - Basis vector to be show
	* @param origin - Unit cell origin
	* @param color - Color of the arrow and the label
	* @param axisLabel - Label of the vector
	* @param group - The arrow is added to this group
	*/
	private basisVectorArrow(basis: THREE.Vector3, origin: THREE.Vector3,
							color: string, axisLabel: string, group: THREE.Group): void {

		const versor = basis.clone().normalize();
		const basisLen = basis.length();

		const size = 0.05;
		const coneSize = 2*size;
		const coneLen = 5*size;

		const cylinder = new THREE.Mesh(
			new THREE.CylinderGeometry(size, size, basisLen-coneLen, 10),
			new THREE.MeshBasicMaterial({color})
		);

		this.setDirection(versor, cylinder.quaternion);
		cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

		// Arrow tips
		const cone = new THREE.Mesh(
			new THREE.ConeGeometry(coneSize, coneLen, 8, 1),
			new THREE.MeshBasicMaterial({color})
		);

		cone.quaternion.copy(cylinder.quaternion);
		cone.position.addVectors(basis, origin);
		cone.position.addScaledVector(versor, -coneLen/2);

		// Label
		const labelPosition: PositionType = [
			basis.x+origin.x+versor.x*0.1,
			basis.y+origin.y+versor.y*0.1,
			basis.z+origin.z+versor.z*0.1
		];
		const sprite = spriteText(axisLabel, color, labelPosition);

		group.add(cylinder, cone, sprite);
		sm.modified();
	}

	/**
	 * Draw the unit cell vectors
	 *
	 * @param vertices - Basis vectors and cell origin (vertices[0-8]: basis; vertices[9-11]: origin)
	 * @param visible - If the vectors are visible when created
	 */
	drawBasisVectors(vertices: number[], visible: boolean): void {

		// Clear basis vectors
		sm.clearGroup(this.nameBV);

		// Not visible, do nothing
		if(vertices.length < 12) return;

		// Basis vectors visible, create them
		const originZero = new THREE.Vector3(vertices[9], vertices[10], vertices[11]);

		const basisA = new THREE.Vector3(vertices[0], vertices[1], vertices[2]);
		const basisB = new THREE.Vector3(vertices[3], vertices[4], vertices[5]);
		const basisC = new THREE.Vector3(vertices[6], vertices[7], vertices[8]);

		this.basisVectorArrow(basisA, originZero, "#FF0000", "a", this.outBV);
		this.basisVectorArrow(basisB, originZero, "#79FF00", "b", this.outBV);
		this.basisVectorArrow(basisC, originZero, "#0000FF", "c", this.outBV);

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
			this.lineSC.material = this.setMaterial(colorSC, dashedSC);
			if(dashedSC) this.lineSC.computeLineDistances();
		}
		if(this.lineUC) {
			this.lineUC.material = this.setMaterial(colorUC, dashedUC);
			if(dashedUC) this.lineUC.computeLineDistances();
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
		this.outBV.visible = showBasisVectors;
		sm.modified();
	}
}
