/**
 * Display the structure unit cell and replicate structure for a supercell.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import SpriteText from "three-spritetext";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";
import type {BasisType, PositionType, Structure, Atom} from "@/types";

export class DrawUnitCell {

	private readonly nameUC: string;
	private readonly nameSC: string;
	private readonly nameBV: string;
	private readonly outUC = new THREE.Group();
	private readonly outSC = new THREE.Group();
	private readonly outBV = new THREE.Group();
	private lineUC: THREE.LineSegments | undefined;
	private lineSC: THREE.LineSegments | undefined;
	private showUnitCell = true;
	private dashedLine = false;
	private showBasisVectors = false;
	private lineColor = "#0000FF";
	private repetitionsA = 1;
	private repetitionsB = 1;
	private repetitionsC = 1;
	private previousRepetitionsA = 1;
	private previousRepetitionsB = 1;
	private previousRepetitionsC = 1;
	private showSupercell = false;
	private supercellColor = "#02A502";
	private dashedSupercell = false;
	private structure: Structure | undefined;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Unit Cell node
	 */
	constructor(private readonly id: string) {

		// Prepare the groups and add to scene
		this.nameUC = `DrawUnitCell-${this.id}`;
		this.outUC.name = this.nameUC;
		sm.add(this.outUC);
		this.nameSC = `DrawSupercell-${this.id}`;
		this.outSC.name = this.nameSC;
		sm.add(this.outSC);
		this.nameBV = `DrawBasisVectors-${this.id}`;
		this.outBV.name = this.nameBV;
		sm.add(this.outBV);

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.showUnitCell = params.showUnitCell as boolean ?? true;
			this.lineColor = params.lineColor as string ?? "#0000FF";
			this.dashedLine = params.dashedLine as boolean ?? false;
			this.showBasisVectors = params.showBasisVectors as boolean ?? false;

			this.outUC.visible = this.showUnitCell;
			this.outBV.visible = this.showBasisVectors;

    		this.repetitionsA = params.repetitionsA as number ?? 1;
    		this.repetitionsB = params.repetitionsB as number ?? 1;
    		this.repetitionsC = params.repetitionsC as number ?? 1;
    		this.showSupercell = params.showSupercell as boolean ?? false;
    		this.supercellColor = params.supercellColor as string ?? "#02A502";
    		this.dashedSupercell = params.dashedSupercell as boolean ?? false;

			if(this.repetitionsA !== this.previousRepetitionsA ||
			   this.repetitionsB !== this.previousRepetitionsB ||
			   this.repetitionsC !== this.previousRepetitionsC) {
				this.drawSupercell(this.structure!.crystal.basis, this.structure!.crystal.origin);
				this.previousRepetitionsA = this.repetitionsA;
				this.previousRepetitionsB = this.repetitionsB;
				this.previousRepetitionsC = this.repetitionsC;
				this.replicateUnitCell();
			}
			this.outSC.visible = this.showSupercell;
			this.changeMaterials();
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			if(!this.structure) return;
			const {crystal} = this.structure;
			if(!crystal) return;

			this.drawUnitCell(crystal.basis, crystal.origin);
			this.drawSupercell(crystal.basis, crystal.origin);
			this.drawBasisVectors(crystal.basis, crystal.origin);
			this.replicateUnitCell();
		});
	}

	/**
	 * Draw the unit cell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private drawUnitCell(basis: BasisType, orig: PositionType): void {

		// Clear previous cell
		sm.clearGroup(this.nameUC);

		// If no unit cell return
		if(basis.every((value) => value === 0)) return;

		// Vertices coordinates (bottom then top)
    	const vertices = new Float32Array([
/* 0 */ orig[0],                            orig[1],                            orig[2],
/* 1 */ orig[0]+basis[0],                   orig[1]+basis[1],                   orig[2]+basis[2],
/* 2 */ orig[0]+basis[0]+basis[3],          orig[1]+basis[1]+basis[4],          orig[2]+basis[2]+basis[5],
/* 3 */ orig[0]+basis[3],                   orig[1]+basis[4],                   orig[2]+basis[5],
/* 4 */ orig[0]+basis[6],                   orig[1]+basis[7],                   orig[2]+basis[8],
/* 5 */ orig[0]+basis[0]+basis[6],          orig[1]+basis[1]+basis[7],          orig[2]+basis[2]+basis[8],
/* 6 */ orig[0]+basis[0]+basis[3]+basis[6], orig[1]+basis[1]+basis[4]+basis[7], orig[2]+basis[2]+basis[5]+basis[8],
/* 7 */ orig[0]+basis[3]+basis[6],          orig[1]+basis[4]+basis[7],          orig[2]+basis[5]+basis[8],
    	]);

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

	    const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
		const edges = new THREE.EdgesGeometry(geometry);

        this.lineUC = new THREE.LineSegments(edges, this.setMaterial(this.lineColor, this.dashedLine));
        if(this.dashedLine) this.lineUC.computeLineDistances();
        this.outUC.add(this.lineUC);
	}

	/**
	 * Draw the basis vectors
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private drawBasisVectors(basis: BasisType, orig: PositionType): void {

		// Clear previous cell
		sm.clearGroup(this.nameBV);

		const originZero = new THREE.Vector3(...orig);

		const basisA = new THREE.Vector3(basis[0], basis[1], basis[2]);
		const basisB = new THREE.Vector3(basis[3], basis[4], basis[5]);
		const basisC = new THREE.Vector3(basis[6], basis[7], basis[8]);

		const basisALen = basisA.length();
		const basisBLen = basisB.length();
		const basisCLen = basisC.length();

		const nA = basisA.clone().normalize();
		const nB = basisB.clone().normalize();
		const nC = basisC.clone().normalize();

		const arrowA = new THREE.ArrowHelper(nA, originZero, basisALen, 0xFF0000, 0.4, 0.2);
		const arrowB = new THREE.ArrowHelper(nB, originZero, basisBLen, 0x79FF00, 0.4, 0.2);
		const arrowC = new THREE.ArrowHelper(nC, originZero, basisCLen, 0x0000FF, 0.4, 0.2);

		this.outBV.add(arrowA, arrowB, arrowC);

		const spriteA = new SpriteText("a", 0.3, "#FF0000");
		spriteA.fontSize = 180;
		spriteA.position.addVectors(basisA, new THREE.Vector3(0.1+orig[0], orig[1], orig[2]));

		const spriteB = new SpriteText("b", 0.3, "#79FF00");
		spriteB.fontSize = 180;
		spriteB.position.addVectors(basisB, new THREE.Vector3(orig[0], 0.1+orig[1], orig[2]));

		const spriteC = new SpriteText("c", 0.3, "#0000FF");
		spriteC.fontSize = 180;
		spriteC.position.addVectors(basisC, new THREE.Vector3(orig[0], orig[1], 0.1+orig[2]));

		this.outBV.add(spriteA, spriteB, spriteC);
	}

	/**
	 * Draw the supercell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private drawSupercell(basis: BasisType, orig: PositionType): void {

		// Clear previous cell
		sm.clearGroup(this.nameSC);

		// If no unit cell return
		if(basis.every((value) => value === 0)) return;

		// If no supercell return
		if(this.repetitionsA === 1 && this.repetitionsB === 1 && this.repetitionsC === 1) return;

		// Supercell basis
		const scb = [
			basis[0]*this.repetitionsA,
			basis[1]*this.repetitionsA,
			basis[2]*this.repetitionsA,
			basis[3]*this.repetitionsB,
			basis[4]*this.repetitionsB,
			basis[5]*this.repetitionsB,
			basis[6]*this.repetitionsC,
			basis[7]*this.repetitionsC,
			basis[8]*this.repetitionsC,
		];

		// Vertices coordinates (bottom then top)
    	const vertices = new Float32Array([
/* 0 */ orig[0],                      orig[1],                      orig[2],
/* 1 */ orig[0]+scb[0],               orig[1]+scb[1],               orig[2]+scb[2],
/* 2 */ orig[0]+scb[0]+scb[3],        orig[1]+scb[1]+scb[4],        orig[2]+scb[2]+scb[5],
/* 3 */ orig[0]+scb[3],               orig[1]+scb[4],               orig[2]+scb[5],
/* 4 */ orig[0]+scb[6],               orig[1]+scb[7],               orig[2]+scb[8],
/* 5 */ orig[0]+scb[0]+scb[6],        orig[1]+scb[1]+scb[7],        orig[2]+scb[2]+scb[8],
/* 6 */ orig[0]+scb[0]+scb[3]+scb[6], orig[1]+scb[1]+scb[4]+scb[7], orig[2]+scb[2]+scb[5]+scb[8],
/* 7 */ orig[0]+scb[3]+scb[6],        orig[1]+scb[4]+scb[7],        orig[2]+scb[5]+scb[8],
    	]);

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

	    const geometry = new THREE.BufferGeometry();
		geometry.setIndex(indices);
		geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
		const edges = new THREE.EdgesGeometry(geometry);

        this.lineSC = new THREE.LineSegments(edges, this.setMaterial(this.supercellColor, this.dashedSupercell));
        if(this.dashedSupercell) this.lineSC.computeLineDistances();
        this.outSC.add(this.lineSC);
	}

	/**
	 * Define the material to be used to draw the lines
	 *
	 * @param color - Color of the lines
	 * @param dashed - If the line should be dashed
	 * @returns The material to apply to the lines
	 */
	private setMaterial(color: string, dashed: boolean): THREE.Material {
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
	 * Change the materials
	 */
	private changeMaterials(): void {
		if(this.lineUC) {
			this.lineUC.material = this.setMaterial(this.lineColor, this.dashedLine);
        	if(this.dashedLine) this.lineUC.computeLineDistances();
		}
		if(this.lineSC) {
			this.lineSC.material = this.setMaterial(this.supercellColor, this.dashedSupercell);
        	if(this.dashedSupercell) this.lineSC.computeLineDistances();
		}
	}

	/**
	 * Replicate the structure to fill the supercell
	 */
	private replicateUnitCell(): void {

		if(!this.structure) return;
		const natoms = this.structure.atoms.length;
		if(natoms === 0) return;
		const bs = this.structure.crystal.basis;
		const atoms: Atom[] = [];
		for(let a=0; a < this.repetitionsA; ++a) {
			for(let b=0; b < this.repetitionsB; ++b) {
				for(let c=0; c < this.repetitionsC; ++c) {
					for(let i=0; i < natoms; ++i) {
						const position: PositionType = [
							this.structure.atoms[i].position[0] + a*bs[0] + b*bs[3] + c*bs[6],
							this.structure.atoms[i].position[1] + a*bs[1] + b*bs[4] + c*bs[7],
							this.structure.atoms[i].position[2] + a*bs[2] + b*bs[5] + c*bs[8],
						];

						atoms.push({
							position,
							atomZ: this.structure.atoms[i].atomZ,
							label: this.structure.atoms[i].label,
						});
					}
				}
			}
		}

		// Remove duplicated
		const tol = 1e-5;
		const outAtoms = atoms.length;
		const duplicated = Array(outAtoms).fill(false) as boolean[];
		for(let i=0; i < outAtoms-1; ++i) {
			if(duplicated[i]) continue;
			for(let j=i+1; j < outAtoms; ++j) {
				if(duplicated[j]) continue;

				const fdx = atoms[i].position[0] - atoms[j].position[0];
				if(fdx < tol && fdx > -tol) {
					const fdy = atoms[i].position[1] - atoms[j].position[1];
					if(fdy < tol && fdy > -tol) {
						const fdz = atoms[i].position[2] - atoms[j].position[2];
						if(fdz < tol && fdz > -tol) {
							duplicated[j] = true;
						}
					}
				}
			}
		}

		// Create out
		const out: Structure = {
			crystal: this.structure!.crystal,
			atoms: [],
			bonds: [],
			look: this.structure!.look,
			volume: this.structure!.volume
		};
		for(let i=0; i < outAtoms; ++i) {
			if(duplicated[i]) continue;
			out.atoms.push(atoms[i]);
		}

		// Output the result
		sb.setData(this.id, out);
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			showUnitCell: this.showUnitCell,
			dashedLine: this.dashedLine,
			lineColor: this.lineColor,
			showBasisVectors: this.showBasisVectors,
        	repetitionsA: this.repetitionsA,
        	repetitionsB: this.repetitionsB,
        	repetitionsC: this.repetitionsC,
        	showSupercell: this.showSupercell,
        	supercellColor: this.supercellColor,
        	dashedSupercell: this.dashedSupercell
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
