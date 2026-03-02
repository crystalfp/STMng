/**
 * Add bonds to the input structure.
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {NodeCore} from "../modules/NodeCore";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {sendToClient} from "../modules/ToClient";
import {EmptyStructure} from "../modules/EmptyStructure";
import {hasNoUnitCell, isHydrogenBond, isNormalBond, vectorAngle} from "../modules/Helpers";
import type {Structure, Bond, Atom, CtrlParams, ChannelDefinition} from "@/types";
import {displacementCoefficients, type AddKind,
		AddType, BondType} from "../../services/SharedConstants";

/**
 * Data for the per atom pair multiplier of the sum of covalent radii
 * @notExported
 */
interface PairData {
	/** The atom symbol pair */
    label:  string;
	/** First atom type */
	atomZi: number;
	/** Second atom type */
	atomZj: number;
	/** The multiplier for the sum of covalent radii */
    scale:  number;
}

/** Possible atoms Z values that form a H bond (N, O, F, S) */
const atomZForH = new Set([7, 8, 9, 16]);

const MAX_ATOMS_FOR_BONDS = 1_000;


export class ComputeBonds extends NodeCore {

	private inputStructure: Structure | undefined;
	private minBondingDistance      = 0.64;
	private maxBondingDistance      = 4.50;
	private maxHBondingDistance     = 3.00;
	private maxHValenceAngle        = 30;
	private enableComputeBonds      = true;
	private bondScale               = 1.1;
	private perPairScale		    = false;
	private perPairData: PairData[] = [];
	private addType: AddKind[]      = [];
	private enlargementKind         = "neighbors";
	private readonly bondsList      = new Map<number, number[]>();


	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",	callback: this.channelInit.bind(this)},
		{name: "changes",	type: "send",	callback: this.channelChanges.bind(this)},
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

		this.inputStructure = data;

		if(!this.inputStructure?.atoms.length) {
			this.toNextNode(new EmptyStructure());
			return;
		}

		// Create atoms pair list
		this.createPairData();

		// Disable bonds computation if there are too many atoms
		if((this.inputStructure?.atoms?.length ?? 0) > MAX_ATOMS_FOR_BONDS) {
			this.enableComputeBonds = false;
			sendToClient(this.id, "params", {
				enableComputeBonds: false,
				maxAtoms: MAX_ATOMS_FOR_BONDS
			});
		}
		else {
			sendToClient(this.id, "params", {
				perPairData: JSON.stringify(this.perPairData)
			});
		}

		this.addBonds();
	}

	// > Create the table of per atom pair multiplier
	/**
	 * Create the table of per atom pair multiplier of the sum of covalent radii
	 */
	private createPairData(): void {

		// Get the structure atoms
		if(!this.inputStructure?.atoms?.length) {
			this.perPairData = [];
			return;
		}
		const {atoms} = this.inputStructure;

		const atomsZ = new Set<number>();
		for(const atom of atoms) atomsZ.add(atom.atomZ);

		// Remove previous entries not existing in the current structure
		let len = this.perPairData.length;
		for(let i=len-1; i >= 0; --i) {
			if(!atomsZ.has(this.perPairData[i].atomZi) || !atomsZ.has(this.perPairData[i].atomZj)) {
				this.perPairData.splice(i, 1);
			}
		}

		// Get the type of atoms in the structure
		const z = [...atomsZ];

		// Add missing pairs
		len = z.length;
		for(let i=0; i < len; ++i) {
			for(let j=i; j < len; ++j) {

				// No H-H bonds
				// if(z[i] === 1 && z[j] === 1) continue;

				let add = true;
				for(const pair of this.perPairData) {
					if((pair.atomZi === z[i] && pair.atomZj === z[j]) ||
					   (pair.atomZi === z[j] && pair.atomZj === z[i])) {
						add = false;
						break;
					}
				}

				if(add) {
					this.perPairData.push({
						label:  getAtomicSymbol(z[i]) + " – " + getAtomicSymbol(z[j]),
						atomZi: z[i],
						atomZj: z[j],
						scale:  1.1
					});
				}
			}
		}
	}

	// >  Add atoms from the 26 cells around the given cell
	/**
	 * Add atoms from the 26 cells around the given cell
	 *
	 * @returns Structure with added adjacent atoms
	 */
	private addOutsideAtoms(): Structure {

		const natoms = this.inputStructure!.atoms.length;
		const {crystal, atoms, volume, extra} = this.inputStructure!;
		const {basis} = crystal;

		// Add the input atoms
		const outAtoms = structuredClone(atoms);

		// The first atoms are the ones inside the unit cell
		this.addType = Array<AddKind>(natoms).fill(AddType.inside);

		// Add adjacent atoms (don't use for...of)
		for(let i=0; i < natoms; ++i) {

			const atom = atoms[i];

			for(const c of displacementCoefficients) {

				outAtoms.push({
					atomZ: atom.atomZ,
					label: atom.label,
					chain: atom.chain,
					position: [
						atom.position[0]+c[0]*basis[0]+c[1]*basis[3]+c[2]*basis[6],
						atom.position[1]+c[0]*basis[1]+c[1]*basis[4]+c[2]*basis[7],
						atom.position[2]+c[0]*basis[2]+c[1]*basis[5]+c[2]*basis[8],
					]
				});
				this.addType.push(AddType.outside);
			}
		}

		// Remove external atoms coincident with internal ones
		const fullCount = outAtoms.length;
		const TOL = 1e-3;
		for(let i=0; i < natoms; ++i) {
			for(let j=natoms; j < fullCount; ++j) {
				if(this.addType[j] === AddType.removed) continue;

				const dx = outAtoms[i].position[0] - outAtoms[j].position[0];
				if(dx < TOL && dx > -TOL) {
					const dy = outAtoms[i].position[1] - outAtoms[j].position[1];
					if(dy < TOL && dy > -TOL) {
						const dz = outAtoms[i].position[2] - outAtoms[j].position[2];
						if(dz < TOL && dz > -TOL) {
							this.addType[j] = AddType.removed;
						}
					}
				}
			}
		}

		// Mark coincident external atoms
		for(let i=natoms; i < fullCount-1; ++i) {
			if(this.addType[i] === AddType.removed) continue;
			for(let j=i+1; j < fullCount; ++j) {
				if(this.addType[j] === AddType.removed) continue;

				const dx = outAtoms[i].position[0] - outAtoms[j].position[0];
				if(dx < TOL && dx > -TOL) {
					const dy = outAtoms[i].position[1] - outAtoms[j].position[1];
					if(dy < TOL && dy > -TOL) {
						const dz = outAtoms[i].position[2] - outAtoms[j].position[2];
						if(dz < TOL && dz > -TOL) {
							this.addType[j] = AddType.removed;
						}
					}
				}
			}
		}

		// Remove coincident atoms
		for(let i=fullCount-1; i >= 0; --i) {
			if(this.addType[i] === AddType.removed) {
				this.addType.splice(i, 1);
				outAtoms.splice(i, 1);
			}
		}

		return {
			crystal,
			atoms: outAtoms,
			bonds: [],
			volume,
			extra
		};
	}

	// > Clear outside atoms
	/**
	 *  Remove added atoms that are not bonded to inside atoms
	 */
	private leaveNeighborAtoms(): void {

		this.markConnectedTo(AddType.inside, AddType.outside, AddType.added);
	}

	/**
	 * Find connected atoms outside the unit cell
	 */
	private leaveConnectedAtoms(): void {

		let changed = this.markConnectedTo(AddType.inside, AddType.outside, AddType.added);
		while(changed > 0) {
			changed = this.markConnectedTo(AddType.added, AddType.outside, AddType.added);
		}
	}
/*
	private dump(): void {

		console.log("----");
		for(const [center, connected] of this.bondsList.entries()) {

			let a1 = 0;
			let a2 = 0;
			let i1 = 0;
			for(const idx of connected) {

				switch(this.addType[idx]) {
				case AddType.added:
					++a1;
					break;
				case AddType.added2:
					++a2;
					break;
				case AddType.inside:
					++i1;
					break;
				case AddType.outside:
					break;
				case AddType.removed:
					break;
				}
			}
			if(a1+a2+i1 !== 3) continue;

			const three = a1+a2+i1 >= 3 ? "*" : "";
			console.log(center, "A".repeat(a1) + "B".repeat(a2) + "I".repeat(i1) + "O".repeat(connected.length-a1-a2-i1), three);
		}
	}
*/

	/**
	 * Leave outside atoms that could create a polyhedra with inside atoms
	 */
	private leavePolyhedraAtoms(): void {

		// Add atoms that bond to internal atoms
		this.markConnectedTo(AddType.inside, AddType.outside, AddType.added);

		// Add atoms that bond to the newly added ones
		this.markConnectedTo(AddType.added, AddType.outside, AddType.added2);

		// this.dump();

		// For each atoms 2nd level of connection
		for(const [center, connected] of this.bondsList.entries()) {

			if(this.addType[center] !== AddType.added2) continue;
			// if(this.addType[center] !== AddType.added &&
			//    this.addType[center] !== AddType.added2) continue;

			// let i1 = 0;
			let a1 = 0;
			let a2 = 0;
			for(const idx of connected) {

				switch(this.addType[idx]) {
				case AddType.added:
					++a1;
					break;
				case AddType.added2:
					++a2;
					break;
				case AddType.inside:
					// ++i1;
					break;
				case AddType.outside:
					break;
				case AddType.removed:
					break;
				}
			}

			// if(a2 === 2 && a1 === 1) this.addType[center] = AddType.outside;
			if((a2 === 2 && a1 === 1) ||
			   (a2 === 1 && a1 === 2)) this.addType[center] = AddType.outside;
			// if((a2 === 2 && a1 === 1) ||
			//    (a2 === 1 && a1 === 2) ||
			//    (i1 === 1 && a2 === 2 && this.addType[center] === AddType.added)) this.addType[center] = AddType.outside;

			// else if(i1 === 1 && a2 === 2 && this.addType[center] === AddType.added) {
			// 	this.addType[center] = AddType.outside;
			// 	for(const idx of connected) {
			// 		if(this.addType[idx] === AddType.added2) {
			// 			this.addType[center] = AddType.outside;
			// 		}
			// 	}
			// }
		}
	}

	/**
	 * Remove unneeded outside atoms and bonds not marked to be retained
	 * Retained have addType equal added or added2
	 *
	 * @param structure - The augmented structure with the 26 cell replicas
	 */
	private removeUnmarkedAtoms(structure: Structure): void {

		// Remove unneeded bonds
		const updatedBonds: Bond[] = [];
		for(const {from, to, type} of structure.bonds) {

			const tf = this.addType[from];
			const tt = this.addType[to];
			if(tf !== AddType.outside && tt !== AddType.outside) {
				updatedBonds.push({from, to, type});
			}
		}
		structure.bonds.length = 0;
		for(const bond of updatedBonds) structure.bonds.push(bond);

		// Preparing the atoms index mapping before removing outside not connected atoms
		const mapIdx = new Map<number, number>();
		const len = this.addType.length;
		for(let i=0, j=0; i < len; ++i) {

			if(this.addType[i] !== AddType.outside) {
				mapIdx.set(i, j);
				++j;
			}
		}

		// Remove unmarked atoms
		const updatedAtoms: Atom[] = [];
		for(let i=0; i < len; ++i) {
			if(this.addType[i] !== AddType.outside) {
				updatedAtoms.push(structuredClone(structure.atoms[i]));
			}
		}
		structure.atoms.length = 0;
		for(const atom of updatedAtoms) structure.atoms.push(atom);

		// Remap indices of atoms in the bonds
		const nbonds = structure.bonds.length;
		for(let i=nbonds-1; i >= 0; --i) {
			structure.bonds[i].from = mapIdx.get(structure.bonds[i].from)!;
			structure.bonds[i].to = mapIdx.get(structure.bonds[i].to)!;
		}
	}

	/**
	 * Transform the bonds into list of connected atoms to each atom
	 *
	 * @param bonds - Structure bonds
	 */
	private makeBondsList(bonds: Bond[]): void {

		this.bondsList.clear();

		for(const {from, to, type} of bonds) {

			// Skip not normal bonds
			if(type !== BondType.normal) continue;

			if(this.bondsList.has(from)) {
				this.bondsList.get(from)!.push(to);
			}
			else {
				this.bondsList.set(from, [to]);
			}
			if(this.bondsList.has(to)) {
				this.bondsList.get(to)!.push(from);
			}
			else {
				this.bondsList.set(to, [from]);
			}
		}
	}

	/**
	 * Change type of selected atoms types
	 *
	 * @param fromType - Type of the atom from which the bonds start
	 * @param toType - The type of the connected atom for which the type should be modified
	 * @param setType - New type of the selected atom
	 * @returns The number of atoms whose type has been changed
	 */
	private markConnectedTo(fromType: AddKind, toType: AddKind, setType: AddKind): number {

		let changed = 0;
		for(const [from, toList] of this.bondsList) {

			if(this.addType[from] !== fromType) continue;

			for(const to of toList) {
				if(this.addType[to] === toType) {
					this.addType[to] = setType;
					++changed;
				}
			}
		}
		return changed;
	}

	// > Add bonds to output structure
	/**
	 * Add bonds to output structure
	 */
	private addBonds(): void {

		// If no input structure, output an empty structure
		if(!this.inputStructure?.atoms || this.inputStructure.atoms.length === 0) {

			this.toNextNode(new EmptyStructure());
		}
		else if(this.enableComputeBonds) {

			// If no enlargement or no unit cell, do nothing
			if(this.enlargementKind === "none" ||
			   hasNoUnitCell(this.inputStructure.crystal.basis)) {

				// Disable the requested enlargement
				this.enlargementKind = "none";

				// Extract input parts to be copied to output
				const {crystal, atoms, volume, extra} = this.inputStructure;

				// Send the input structure down the pipeline
				this.toNextNode({
					crystal,
					atoms,
					bonds: this.computeBonds(this.inputStructure),
					volume,
					extra
				});
			}
			else {

				// Add the 26 replicas around the unit cell
				const enlargedStructure = this.addOutsideAtoms();
				enlargedStructure.bonds = this.computeBonds(enlargedStructure);
				this.makeBondsList(enlargedStructure.bonds);

				// Mark atoms to be retained
				switch(this.enlargementKind) {
					case "neighbors":
						this.leaveNeighborAtoms();
						break;
					case "polyhedra":
						this.leavePolyhedraAtoms();
						break;
					case "connected":
						this.leaveConnectedAtoms();
						break;
				}

				// Remove unmarked atoms
				this.removeUnmarkedAtoms(enlargedStructure);

				this.toNextNode(enlargedStructure);
			}
		}
		else {

			this.toNextNode(this.inputStructure);
		}
	}

	// > Possible H bond
	/**
	 * Check if an H bond could form.
	 * The H bonds form when X–H⋅⋅⋅Y and X, Y are N, O, F (and also S)
	 *
	 * @param atomZ - Atomic number of the X or Y atoms
	 * @returns True if an H bond could form
	 */
	private static atomForHBond(atomZ: number): boolean {return atomZForH.has(atomZ);}

	// > Compute the valence angle
	/**
	* Compute the valence angle. In X–H⋅⋅⋅Y the valence angle is HXY
	*
	* @param atomH - Hydrogen atom
	* @param atomX - Atom at one side
	* @param atomY - Atom at the other side
	* @returns Valence angle in degrees
	*/
	private static valenceAngle(atomH: Atom, atomX: Atom, atomY: Atom): number {

		const v0 = atomH.position[0] - atomX.position[0];
		const w0 = atomY.position[0] - atomX.position[0];
		const v1 = atomH.position[1] - atomX.position[1];
		const w1 = atomY.position[1] - atomX.position[1];
		const v2 = atomH.position[2] - atomX.position[2];
		const w2 = atomY.position[2] - atomX.position[2];

		return vectorAngle(v0, v1, v2, w0, w1, w2);
	}

	// > Compute bonds
	/**
	 * Compute bonds for the given structure
	 *
	 * @returns Computed bonds list
	 */
	private computeBonds(structure: Structure): Bond[] {

		const {atoms} = structure;

		const radii: number[] = [];
		for(const {atomZ} of atoms) radii.push(getAtomData(atomZ).rCov);

		// No bonds possible
		const atomsCount = atoms.length;
		if(atomsCount < 2) return [];

		// The computed bonds
		const bonds: Bond[] = [];

		// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
		const minDistanceSquared = this.minBondingDistance*this.minBondingDistance;

		// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
		const maxDistanceSquared = this.maxBondingDistance*this.maxBondingDistance;

		// Maximum distance for an H bond
		const maxDistanceHbondSquared = this.maxHBondingDistance*this.maxHBondingDistance;

		// Maximum angle to form a H bond (already in maxHValenceAngle)

		// Compute H bonds only if H atoms present
		const computeHBonds = atoms.some((atom) => atom.atomZ === 1);

		// Visit each pair of atoms
		for(let i=atomsCount-2; i>= 0; --i) {

			const atomZi = atoms[i].atomZ;
			const rCi = radii[i];
			const positionI = atoms[i].position;

			for(let j=i+1; j < atomsCount; ++j) {

				const atomZj = atoms[j].atomZ;
				const rCj = radii[j];
				const positionJ = atoms[j].position;

				// Don't compute bonds between external atoms
				if(this.enlargementKind === "neighbors" &&
				   this.addType[i] === AddType.outside &&
				   this.addType[j] === AddType.outside) continue;

				// Never bond hydrogens to each other...
				// if(atomZi === 1 && atomZj === 1) continue;

				// Compute distance between atoms
				const dx = positionI[0] - positionJ[0];
				const dy = positionI[1] - positionJ[1];
				const dz = positionI[2] - positionJ[2];

				// If atoms are distant along one axis, it is sure they cannot bind
				if(dx > this.maxBondingDistance || dy > this.maxBondingDistance || dz > this.maxBondingDistance) continue;

				// Check more precise limits
				const distSquared = dx*dx+dy*dy+dz*dz;
				if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

				// Get the distance for bonding
				const sumRcov = (rCi + rCj)*this.boundingScale(atomZi, atomZj);
				const sumRcovSquared = sumRcov*sumRcov;

				// Check for H-bond
				if(computeHBonds &&
				   ((atomZi === 1 && ComputeBonds.atomForHBond(atomZj)) ||
				    (atomZj === 1 && ComputeBonds.atomForHBond(atomZi))) &&
				   (distSquared <= maxDistanceHbondSquared) &&
				   (distSquared > sumRcovSquared)) {

					bonds.push({from: i, to: j, type: BondType.hydrogen});
				}

				// Check for ordinary bond
				else if(distSquared <= sumRcovSquared) {
					bonds.push({from: i, to: j, type: BondType.normal});
				}
			}
		}

		// One H bond forms when X–H⋅⋅⋅Y where X, Y are N, O or F.
		// Here we check the angle HXY. It should be less than maxHValenceAngle (usually 30 deg.)
		const countBonds = bonds.length;
		for(let i=0; i < countBonds; ++i) {

			if(!isHydrogenBond(bonds[i])) continue;

			const idx1 = bonds[i].from;
			const idx2 = bonds[i].to;
			let idxX, idxH, idxY;

			if(atoms[idx1].atomZ === 1) {
				idxH = idx1;
				idxY = idx2;
			}
			else {
				idxH = idx2;
				idxY = idx1;
			}

			for(let j=0; j < countBonds; ++j) {

				if(!isNormalBond(bonds[j])) continue;

				if(bonds[j].from === idxH) {
					idxX = bonds[j].to;
					break;
				}
				if(bonds[j].to === idxH) {
					idxX = bonds[j].from;
					break;
				}
			}

			const atomH = atoms[idxH];
			const atomY = atoms[idxY];

			// If H is not bond to X recompute bond as ordinary bond or remove it
			if(idxX === undefined) {

				// Recompute distance
				const dx = atomH.position[0] - atomY.position[0];
				const dy = atomH.position[1] - atomY.position[1];
				const dz = atomH.position[2] - atomY.position[2];

				const distSquared = dx*dx+dy*dy+dz*dz;

				const rCH = radii[idxH];
				const rCY = radii[idxY];

				const sumCov = (rCH + rCY)*this.boundingScale(atomH.atomZ, atomY.atomZ);
				const sumCovSquared = sumCov*sumCov;

				bonds[i].type = distSquared <= sumCovSquared ? BondType.normal : BondType.invalid;

				continue;
			}

			const atomX = atoms[idxX];
			if(!ComputeBonds.atomForHBond(atomX.atomZ) ||
			   ComputeBonds.valenceAngle(atomH, atomX, atomY) > this.maxHValenceAngle) {
				bonds[i].type = BondType.invalid;
			}
		}

		// Clean up bonds list removing invalid bonds
		const outBonds: Bond[] = [];
		for(let i=0; i < countBonds; ++i) {
			if(bonds[i].type !== BondType.invalid) outBonds.push(bonds[i]);
		}

		return outBonds;
	}

	// > Bonding scale by type
	/**
	 * Bonding scale by type of involved atoms
	 *
	 * @param atomZi - Atom type of the first atom in the possible bond
	 * @param atomZj - Atom type of the second atom in the possible bond
	 * @returns The multiplier for the sum of covalent radii
	 */
	private boundingScale(atomZi: number, atomZj: number): number {

		// Get multiplier for the given pair of atoms
		if(this.perPairScale) {

			for(const pair of this.perPairData) {
				if((pair.atomZi === atomZi && pair.atomZj === atomZj) ||
				   (pair.atomZi === atomZj && pair.atomZj === atomZi)) return pair.scale;
			}
		}

		// Return the default value for all atoms pairs
		return this.bondScale;
	}

	// > Load/save status
	saveStatus(): string {

		const pd = this.perPairData.some((entry) => entry.scale !== 1.1) ? JSON.stringify(this.perPairData) : "[]";
        const statusToSave = {
			minBondingDistance: this.minBondingDistance,
			maxBondingDistance: this.maxBondingDistance,
			maxHBondingDistance: this.maxHBondingDistance,
			maxHValenceAngle: this.maxHValenceAngle,
			enableComputeBonds: this.enableComputeBonds,
			bondScale: this.bondScale,
			perPairScale: this.perPairScale,
			perPairData: pd,
			enlargementKind: this.enlargementKind,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.enableComputeBonds  = params.enableComputeBonds as boolean ?? true;
		this.minBondingDistance  = params.minBondingDistance as number ?? 0.64;
		this.maxBondingDistance  = params.maxBondingDistance as number ?? 4.50;
		this.maxHBondingDistance = params.maxHBondingDistance as number ?? 3.00;
		this.maxHValenceAngle    = params.maxHValenceAngle as number ?? 30;
		this.bondScale    		 = params.bondScale as number ?? 1.1;
		this.perPairScale		 = params.perPairScale as boolean ?? false;
		this.enlargementKind     = params.enlargementKind as string ?? "neighbors";
		this.perPairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			minBondingDistance: this.minBondingDistance,
			maxBondingDistance: this.maxBondingDistance,
			maxHBondingDistance: this.maxHBondingDistance,
			maxHValenceAngle: this.maxHValenceAngle,
			enableComputeBonds: this.enableComputeBonds,
			bondScale: this.bondScale,
			perPairScale: this.perPairScale,
			perPairData: JSON.stringify(this.perPairData),
			enlargementKind: this.enlargementKind,
		};
	}

	/**
	 * Channel handler for the change of parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelChanges(params: CtrlParams): void {

		this.enableComputeBonds  = params.enableComputeBonds as boolean ?? true;
		this.minBondingDistance  = params.minBondingDistance as number ?? 0.64;
		this.maxBondingDistance  = params.maxBondingDistance as number ?? 4.50;
		this.maxHBondingDistance = params.maxHBondingDistance as number ?? 3.00;
		this.maxHValenceAngle    = params.maxHValenceAngle as number ?? 30;
		this.bondScale    		 = params.bondScale as number ?? 1.1;
		this.perPairScale		 = params.perPairScale as boolean ?? false;
		this.enlargementKind     = params.enlargementKind as string ?? "neighbors";
		this.perPairData         = JSON.parse(params.perPairData as string ?? "[]") as PairData[];

		this.addBonds();
	}
}
