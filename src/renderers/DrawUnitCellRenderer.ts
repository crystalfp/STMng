/**
 * Render graphical output for Draw Unit Cell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-11-29
 */
import {Group, Vector3, type Material, ConeGeometry,
		LineDashedMaterial, BufferGeometry, BufferAttribute,
		CylinderGeometry, MeshBasicMaterial,
		Mesh, EdgesGeometry, LineSegments, LineBasicMaterial} from "three";
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

	private readonly outBV = new Group();
	private lineUC: LineSegments | undefined;
	private lineSC: LineSegments | undefined;
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

		// Clear previous cell
		sm.deleteMesh(this.nameUC);
		sm.deleteMesh(this.nameSC);
	}

	/**
	 * Define the material to be used to draw the lines
	 *
	 * @param color - Color of the lines
	 * @param dashed - If the line should be dashed
	 * @returns The material to apply to the lines
	 */
	private setMaterial(color: string, dashed: boolean): Material {

		// eslint-disable-next-line sonarjs/no-selector-parameter
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

		const geometry = new BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
		const edges = new EdgesGeometry(geometry);

		const line = new LineSegments(edges, this.setMaterial(color, dashed));
		if(dashed) line.computeLineDistances();
		line.name = name;
        line.visible = visible;
        sm.add(line);
		sm.modified();

		if(isSupercell) this.lineSC = line;
		else this.lineUC = line;
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
	private basisVectorArrow(basis: Vector3, origin: Vector3,
							 color: string, axisLabel: string, group: Group): void {

		const versor = basis.clone().normalize();
		const basisLen = basis.length();

		const size = 0.05;
		const coneSize = 2*size;
		const coneLen = 5*size;

		const cylinder = new Mesh(
			new CylinderGeometry(size, size, basisLen-coneLen, 10),
			new MeshBasicMaterial({color})
		);

		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...versor));
		cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

		// Arrow tips
		const cone = new Mesh(
			new ConeGeometry(coneSize, coneLen, 8, 1),
			new MeshBasicMaterial({color})
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
	 * @param vertices - Basis vectors and cell origin
	 * vertices[0-8] are the basis; vertices[9-11] the origin
	 * @param visible - If the vectors are visible when created
	 */
	drawBasisVectors(vertices: number[], visible: boolean): void {

		// Clear basis vectors
		sm.clearGroup(this.nameBV);

		// Not visible, do nothing
		if(vertices.length < 12) return;

		// Basis vectors visible, create them
		const originZero = new Vector3(vertices[9], vertices[10], vertices[11]);

		const basisA = new Vector3(vertices[0], vertices[1], vertices[2]);
		const basisB = new Vector3(vertices[3], vertices[4], vertices[5]);
		const basisC = new Vector3(vertices[6], vertices[7], vertices[8]);

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
