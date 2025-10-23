/**
 * Render graphical output for Draw Unit Cell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-11-29
 */
import {Group, Vector3, type Material, ConeGeometry,
		LineDashedMaterial, BufferGeometry, BufferAttribute,
		CylinderGeometry, MeshStandardMaterial, DoubleSide,
		Mesh, EdgesGeometry, LineSegments, LineBasicMaterial} from "three";
import {sm} from "@/services/SceneManager";
import {spriteText} from "@/services/SpriteText";
import type {PositionType} from "@/types";

// Triangles. Top and bottom facies are not needed
const indices = [

    4, 5, 1,
    4, 1, 0,

    3, 2, 6,
    3, 6, 7,

    4, 0, 3,
    4, 3, 7,

    1, 5, 6,
    1, 6, 2,
];

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
	private readonly vertices: number[] = [];
	private alreadyRenderedBV = false;

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

		const line = new LineSegments(edges, DrawUnitCellRenderer.setMaterial(color, dashed));
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

		cylinder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...versor));
		cylinder.position.addVectors(origin, versor.clone().multiplyScalar((basisLen-coneLen)/2));

		// Arrow tips
		const cone = new Mesh(
			new ConeGeometry(coneSize, coneLen, 10, 1),
			material
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
		const sprite = spriteText(axisLabel, color, size*5, labelPosition);

		group.add(cylinder, cone, sprite);
		sm.modified();
	}

	/**
	 * Draw the unit cell vectors
	 *
	 * @param visible - If the vectors are visible when created
	 * @param vertices - Basis vectors and cell origin
	 * vertices[0-8] are the basis; vertices[9-11] the origin
	 */
	drawBasisVectors(visible: boolean, vertices?: number[]): void {

		// When receiving new vertices
		if(vertices) {

			// Save vertices
			for(let i=0; i < 12; ++i) {
				this.vertices[i] = vertices[i];
			}

			// Clear basis vectors
			sm.clearGroup(this.nameBV);
			this.alreadyRenderedBV = false;

			// Nothing to show
			if(!visible) return;
		}
		else if(this.vertices.length === 0) {
			// No vertices, nothing to do
			return;
		}
		else if(this.alreadyRenderedBV) {
			this.outBV.visible = visible;
			sm.modified();
			return;
		}

		// Basis vectors visible, create them
		const originZero = new Vector3(this.vertices[9], this.vertices[10], this.vertices[11]);

		const basisA = new Vector3(this.vertices[0], this.vertices[1], this.vertices[2]);
		const basisB = new Vector3(this.vertices[3], this.vertices[4], this.vertices[5]);
		const basisC = new Vector3(this.vertices[6], this.vertices[7], this.vertices[8]);

		// Find the size of the arrows related to the longest axis
		const la = basisA.length();
		const lb = basisB.length();
		const lc = basisC.length();
		const ltot = Math.max(la, lb, lc);
		const size = Math.max(0.05, ltot/300);

		DrawUnitCellRenderer.basisVectorArrow(basisA, originZero, size, "#FF0000", "a", this.outBV);
		DrawUnitCellRenderer.basisVectorArrow(basisB, originZero, size, "#79FF00", "b", this.outBV);
		DrawUnitCellRenderer.basisVectorArrow(basisC, originZero, size, "#0000FF", "c", this.outBV);

		this.outBV.visible = visible;
		sm.modified();

		this.alreadyRenderedBV = true;
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
		this.drawBasisVectors(showBasisVectors);
		sm.modified();
	}
}
