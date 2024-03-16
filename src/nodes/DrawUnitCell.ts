/**
 * Display the structure unit cell and replicate structure for a supercell.
 *
 * @packageDocumentation
 */
import * as THREE from "three";
import {sb, type UiParams} from "@/services/Switchboard";
import {sm} from "@/services/SceneManager";
import type {BasisType, PositionType, Structure, Atom, Volume} from "@/types";
import {spriteText} from "@/services/SpriteText";

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

		// Prepare the groups and add to the scene
		this.nameUC = `DrawUnitCell-${this.id}`;
		this.outUC.name = this.nameUC;
		sm.add(this.outUC);
		sm.clearGroup(this.nameUC);

		this.nameSC = `DrawSupercell-${this.id}`;
		this.outSC.name = this.nameSC;
		sm.add(this.outSC);
		sm.clearGroup(this.nameSC);

		this.nameBV = `DrawBasisVectors-${this.id}`;
		this.outBV.name = this.nameBV;
		sm.add(this.outBV);
		sm.clearGroup(this.nameBV);


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

		// Clear basis vectors
		sm.clearGroup(this.nameBV);

		const originZero = new THREE.Vector3(...orig);

		const basisA = new THREE.Vector3(basis[0], basis[1], basis[2]);
		const basisB = new THREE.Vector3(basis[3], basis[4], basis[5]);
		const basisC = new THREE.Vector3(basis[6], basis[7], basis[8]);

		this.basisVectorArrow(basisA, originZero, "#FF0000", "a", this.outBV);
		this.basisVectorArrow(basisB, originZero, "#79FF00", "b", this.outBV);
		this.basisVectorArrow(basisC, originZero, "#0000FF", "c", this.outBV);
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
	 * @param label - Label of the vector
	 * @param group - The arrow is added to this group
	 */
	private basisVectorArrow(basis: THREE.Vector3, origin: THREE.Vector3,
							 color: string, label: string, group: THREE.Group): void {

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
		const sprite = spriteText(label, color,
								  [basis.x+origin.x, basis.y+origin.y, basis.z+origin.z],
								  [versor.x*0.1, versor.y*0.1, versor.z*0.1]);

		group.add(cylinder, cone, sprite);
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
		const {crystal} = this.structure!;
		const out: Structure = {

			crystal: {
				basis: [
					crystal.basis[0]*this.repetitionsA,
					crystal.basis[1]*this.repetitionsA,
					crystal.basis[2]*this.repetitionsA,
					crystal.basis[3]*this.repetitionsB,
					crystal.basis[4]*this.repetitionsB,
					crystal.basis[5]*this.repetitionsB,
					crystal.basis[6]*this.repetitionsC,
					crystal.basis[7]*this.repetitionsC,
					crystal.basis[8]*this.repetitionsC,
				],
				origin: crystal.origin,
				spaceGroup: crystal.spaceGroup
			},
			atoms: [],
			bonds: [],
			look: this.structure!.look,
			volume: this.replicateVolume(this.structure!.volume)
		};

		for(let i=0; i < outAtoms; ++i) {
			if(duplicated[i]) continue;
			out.atoms.push(atoms[i]);
		}

		// Output the result
		sb.setData(this.id, out);
	}

	/**
	 * Replicate the volume data to fill the supercell
	 *
	 * @param volume - Input volumetric data
	 * @returns The new volume data for the computed supercell
	 */
	private replicateVolume(volume: Volume[]): Volume[] {

		// If no volumetric data or no replications, do nothing
		if(volume.length === 0) return [];
		if(this.repetitionsA === 1 && this.repetitionsB === 1 && this.repetitionsC === 1) return volume;

		const out: Volume[] = [];
		for(const set of volume) {

			const sides: PositionType = [
				set.sides[0]*this.repetitionsA,
				set.sides[1]*this.repetitionsB,
				set.sides[2]*this.repetitionsC,
			];

			const values = [];
			for(let c=0; c < this.repetitionsC; ++c) {
				for(let ic=0; ic < set.sides[2]; ++ic) {
					for(let b=0; b < this.repetitionsB; ++b) {
						for(let ib=0; ib < set.sides[1]; ++ib) {
							for(let a=0; a < this.repetitionsA; ++a) {
								for(let ia=0; ia < set.sides[0]; ++ia) {
									values.push(set.values[ia+set.sides[0]*(ib+ic*set.sides[1])]);
								}
							}
						}
					}
				}
			}
			out.push({sides, values});
		}

		return out;
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
