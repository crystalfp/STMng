/**
 * Display the structure unit cell and replicate structure for a supercell.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
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
import {NodeCore} from "../modules/NodeCore";
import {adjustOrigin} from "../modules/AdjustOrigin";
import {sendVerticesToClient} from "../modules/ToClient";
import {computeCellVertices} from "../modules/ComputeCellVertices";
import {EmptyStructure} from "../modules/EmptyStructure";
import {hasNoUnitCell} from "../modules/Helpers";
import type {Structure, Atom, CtrlParams, ChannelDefinition,
			 PositionType, BasisType, Volume} from "@/types";

export class DrawUnitCell extends NodeCore {

	private inputStructure: Structure | undefined;
	private repetitionsA = 1;
	private repetitionsB = 1;
	private repetitionsC = 1;
	private percentA = 0;
	private percentB = 0;
	private percentC = 0;
	private shrink = false;
	private showUnitCell = true;
	private dashedLine = false;
	private showBasisVectors = false;
	private lineColor = "#0000FF";
	private showSupercell = false;
	private supercellColor = "#02A502";
	private dashedSupercell = false;
	private lineWidth = 0;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "visible",	type: "send", 	callback: this.channelVisible.bind(this)},
		{name: "repeat",	type: "send", 	callback: this.channelRepetitions.bind(this)},
		{name: "origin",	type: "send", 	callback: this.channelOrigin.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		// No data, output an empty structure
		this.inputStructure = data;
		if(!this.inputStructure?.atoms.length) {
			this.toNextNode(new EmptyStructure());
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		// Structure should have the unit cell
		const {crystal} = this.inputStructure;
		if(!crystal || hasNoUnitCell(crystal.basis)) {
			this.toNextNode(this.inputStructure);
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		const {basis, origin} = crystal;

		// Nothing to be changed in the structure
		if(!this.hasSupercell() &&
		   this.percentA === 0 && this.percentB === 0 && this.percentC === 0) {

			this.toNextNode(this.inputStructure);

			this.computeUnitCell(basis, origin);
			this.computeSupercell(basis, origin);
			this.computeBasisVectors(basis, origin);
			return;
		}

		// Adjust origin if any of the percentages is greather than zero
		let structure: Structure | undefined = this.adjustStructureOrigin();

		// Create unit and supercell
		if(structure) {

			const {basis: basis2, origin: origin2} = structure.crystal;
			this.computeUnitCell(basis2, origin2);
			this.computeSupercell(basis2, origin2);
			this.computeBasisVectors(basis2, origin2);
		}

		// If there are replications
		if(this.hasSupercell()) {

			structure = this.replicateUnitCell(structure);
		}

		// Pass the structure to next node
		if(structure) this.toNextNode(structure);
		else this.toNextNode(new EmptyStructure());
	}

	/**
	 * Adjust origin if any of the percentages is greater than zero
	 */
	private adjustStructureOrigin(): Structure {

		const {crystal, atoms, extra, volume} = this.inputStructure!;

		return (this.percentA !== 0 || this.percentB !== 0 || this.percentC !== 0) ?
			adjustOrigin(this.inputStructure!,
						 this.percentA/100,
						 this.percentB/100,
						 this.percentC/100,
						 this.shrink)
			:
			{
				crystal,
				atoms,
				bonds: [],
				volume,
				extra
			};
	}

	/**
	 * Check if a supercell has been requested
	 *
	 * @returns True if there is a repetition
	 */
	private hasSupercell(): boolean {
		return this.repetitionsA > 1 || this.repetitionsB > 1 || this.repetitionsC > 1;
	}

	/**
	 * Replicate the structure to fill the supercell
	 */
	private replicateUnitCell(structure: Structure): Structure | undefined {

		if(!structure) return undefined;
		const natoms = structure.atoms.length;
		if(natoms === 0) return undefined;
		const bs = structure.crystal.basis;

		const atoms: Atom[] = [];
		for(let a=0; a < this.repetitionsA; ++a) {
			for(let b=0; b < this.repetitionsB; ++b) {
				for(let c=0; c < this.repetitionsC; ++c) {
					for(let i=0; i < natoms; ++i) {
						const position: PositionType = [
							structure.atoms[i].position[0] + a*bs[0] + b*bs[3] + c*bs[6],
							structure.atoms[i].position[1] + a*bs[1] + b*bs[4] + c*bs[7],
							structure.atoms[i].position[2] + a*bs[2] + b*bs[5] + c*bs[8],
						];

						atoms.push({
							atomZ: structure.atoms[i].atomZ,
							label: structure.atoms[i].label,
							chain: structure.atoms[i].chain+a.toString()+b.toString()+c.toString(),
							position,
						});
					}
				}
			}
		}

		// Remove duplicates
		const tol = 1e-5;
		const outAtoms = atoms.length;
		const duplicated = Array<boolean>(outAtoms).fill(false);
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
		const {crystal, volume, extra} = structure;
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
			volume: this.replicateVolume(volume),
			extra
		};

		for(let i=0; i < outAtoms; ++i) {
			if(duplicated[i]) continue;
			out.atoms.push(atoms[i]);
		}

		// Output the result
		return out;
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
		if(!this.hasSupercell()) return volume;

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
	 * Collect node status
	 *
	 * @returns Collected status
	 */
	private collectStatus(): CtrlParams {
		return {
			showUnitCell: this.showUnitCell,
			dashedLine: this.dashedLine,
			lineColor: this.lineColor,
			showBasisVectors: this.showBasisVectors,
        	repetitionsA: this.repetitionsA,
        	repetitionsB: this.repetitionsB,
        	repetitionsC: this.repetitionsC,
        	showSupercell: this.showSupercell,
        	supercellColor: this.supercellColor,
        	dashedSupercell: this.dashedSupercell,
			lineWidth: this.lineWidth,
			percentA: this.percentA,
			percentB: this.percentB,
			percentC: this.percentC,
			shrink: this.shrink,
		};
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = this.collectStatus();
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.repetitionsA = params.repetitionsA as number ?? 1;
        this.repetitionsB = params.repetitionsB as number ?? 1;
        this.repetitionsC = params.repetitionsC as number ?? 1;
        this.lineColor = params.lineColor as string ?? "#0000FF";
        this.showBasisVectors = params.showBasisVectors as boolean ?? false;
        this.dashedLine = params.dashedLine as boolean ?? false;
        this.showUnitCell = params.showUnitCell as boolean ?? true;
        this.showSupercell = params.showSupercell as boolean ?? this.hasSupercell();
        this.supercellColor = params.supercellColor as string ?? "#16A004";
        this.dashedSupercell = params.dashedSupercell as boolean ?? false;
        this.percentA = params.percentA as number ?? 0;
        this.percentB = params.percentB as number ?? 0;
        this.percentC = params.percentC as number ?? 0;
        this.shrink = params.shrink as boolean ?? false;
		this.lineWidth = params.lineWidth as number ?? 0;
	}

	/**
	 * Send data to draw the unit cell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeUnitCell(basis: BasisType, orig: PositionType): void {

		// If no unit cell or not visible send an empty coords array
		if(hasNoUnitCell(basis)) {
			sendVerticesToClient(this.id, "cell", []);
			return;
		}

		const vertices = computeCellVertices(orig, basis);

		// Send vertices
		sendVerticesToClient(this.id, "cell", vertices);
	}

	/**
	 * Send data to draw the supercell
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeSupercell(basis: BasisType, orig: PositionType): void {

		// If no unit cell send an empty coords array
		if(hasNoUnitCell(basis))  {
			sendVerticesToClient(this.id, "supercell", []);
			return;
		}

		// If no supercell send an empty coords array
		if(!this.hasSupercell())  {
			sendVerticesToClient(this.id, "supercell", []);
			return;
		}

		// Supercell basis
		const scb: BasisType = [
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

		// Supercell vertices coordinates
		const vertices = computeCellVertices(orig, scb);

		// Send vertices
		sendVerticesToClient(this.id, "supercell", vertices);
	}

	/**
	 * Send data to draw the basis vectors
	 *
	 * @param basis - The cell basis vectors
	 * @param orig - The cell origin
	 */
	private computeBasisVectors(basis: BasisType, orig: PositionType): void {

		// No unit cell, do nothing
		if(hasNoUnitCell(basis))  {
			sendVerticesToClient(this.id, "vectors", []);
			return;
		}

		// Send basis and origin
		const combined = [
			basis[0],
			basis[1],
			basis[2],
			basis[3],
			basis[4],
			basis[5],
			basis[6],
			basis[7],
			basis[8],
			orig[0],
			orig[1],
			orig[2],
		];

		sendVerticesToClient(this.id, "vectors", combined);
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return this.collectStatus();
	}

	/**
	 * Channel handler for the change of visibility
	 *
	 * @param params - Parameters from the client
	 */
	private channelVisible(params: CtrlParams): void {
        this.showBasisVectors = params.showBasisVectors as boolean;
        this.showUnitCell = params.showUnitCell as boolean;
        this.showSupercell = params.showSupercell as boolean;
	}

	/**
	 * Channel handler for the change repetitions
	 *
	 * @param params - Parameters from the client
	 */
	private channelRepetitions(params: CtrlParams): void {

        this.repetitionsA = params.repetitionsA as number ?? 1;
        this.repetitionsB = params.repetitionsB as number ?? 1;
        this.repetitionsC = params.repetitionsC as number ?? 1;

		if(!this.inputStructure) return;

		// Send supercell
		const {basis, origin} = this.inputStructure.crystal;
		this.computeSupercell(basis, origin);

		// If there are replications
		const structure = this.hasSupercell() ?
									this.replicateUnitCell(this.inputStructure) : this.inputStructure;

		// Pass the structure to next node
		if(structure) this.toNextNode(structure);
		else this.toNextNode(new EmptyStructure());
	}

	/**
	 * Channel handler for the change adjust origin
	 *
	 * @param params - Parameters from the client
	 */
	private channelOrigin(params: CtrlParams): void {

        this.percentA = params.percentA as number ?? 0;
        this.percentB = params.percentB as number ?? 0;
        this.percentC = params.percentC as number ?? 0;
        this.shrink = params.shrink as boolean ?? false;

		if(!this.inputStructure) return;

		// Adjust origin if any of the percentages is greather than zero
		let structure: Structure | undefined = this.adjustStructureOrigin();

		// Compute unit and supercell
		if(structure) {

			const {basis, origin} = structure.crystal;
			this.computeUnitCell(basis, origin);
			this.computeSupercell(basis, origin);
			this.computeBasisVectors(basis, origin);
		}

		// If there are replications
		if(this.hasSupercell()) {

			structure = this.replicateUnitCell(structure);
		}

		// Pass the structure to next node and compute unit and supercell
		if(structure) this.toNextNode(structure);
		else this.toNextNode(new EmptyStructure());
	}
}
