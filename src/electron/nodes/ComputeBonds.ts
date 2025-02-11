/**
 * Add bonds to the input structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {sendToClient} from "../modules/WindowsUtilities";
import {EmptyStructure} from "../modules/EmptyStructure";
import {hasNoUnitCell, vectorAngle} from "../modules/Helpers";
import type {Structure, Bond, Atom, CtrlParams, ChannelDefinition} from "@/types";

/** Data for the per atom pair multiplier of the sum of covalent radii */
interface PairData {
    label:  string;
	atomZi: number;
	atomZj: number;
    scale:  number;
}

/** Multiplicative coefficients for basis to get atoms adjacent to the unit cell */
const displacementCoefficients = [

	[1,  0, 0], // Z = 0
	[1,  1, 0],
	[1, -1, 0],

	[-1,  0, 0],
	[-1,  1, 0],
	[-1, -1, 0],

	[0,  1, 0], // [0, 0, 0] is obviously missing
	[0, -1, 0],

	[0,  0, 1], // Z = 1
	[0,  1, 1],
	[0, -1, 1],

	[-1,  0, 1],
	[-1,  1, 1],
	[-1, -1, 1],

	[1,  0, 1],
	[1,  1, 1],
	[1, -1, 1],

	[0,  0, -1], // Z = -1
	[0,  1, -1],
	[0, -1, -1],

	[-1,  0, -1],
	[-1,  1, -1],
	[-1, -1, -1],

	[1,  0, -1],
	[1,  1, -1],
	[1, -1, -1],
];

/** Possible atoms Z values that form a H bond */
const atomZForH = new Set([7, 8, 9, 16]);


export class ComputeBonds extends NodeCore {

	private inputStructure: Structure | undefined;
	private minBondingDistance  = 0.64;
	private maxBondingDistance  = 4.50;
	private maxHBondingDistance = 3.00;
	private maxHValenceAngle    = 30;
	private enableComputeBonds  = true;
	private bondScale           = 1.1;
	private perPairScale		= false;
	private perPairData: PairData[] = [];
	private addType: number[]   = []; // 1: atom in unit cell; 2: atom outside unit cell
	private inputNumAtoms		= 0;
	private enlargementKind		= "none";

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",	callback: this.channelInit.bind(this)},
		{name: "changes",	type: "send",	callback: this.channelChanges.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.inputStructure = data;

		if(!this.inputStructure || this.inputStructure.atoms.length === 0) {
			this.toNextNode(new EmptyStructure());
			return;
		}

		// Create atoms pair list
		this.createPairData();

		// Disable bonds computation if there are too many atoms
		if((this.inputStructure?.atoms?.length ?? 0) > 500) {
			this.enableComputeBonds = false;
			sendToClient(this.id, "params", {
				enableComputeBonds: false
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
		this.inputNumAtoms = natoms;
		const {crystal, atoms, volume, extra} = this.inputStructure!;
		const {basis} = crystal;

		// Add the input atoms
		const outAtoms: Atom[] = [];
		for(const atom of atoms) {
			outAtoms.push({
				atomZ: atom.atomZ,
				label: atom.label,
				position: [
					atom.position[0],
					atom.position[1],
					atom.position[2],
				]
			});
		}

		// The first atoms are the ones inside the unit cell
		this.addType = Array(natoms).fill(1) as number[];

		// Add adjacent atoms (don't use for...of)
		for(let i=0; i < natoms; ++i) {

			const atom = atoms[i];

			for(const c of displacementCoefficients) {

				outAtoms.push({
					atomZ: atom.atomZ,
					label: atom.label,
					position: [
						atom.position[0]+c[0]*basis[0]+c[1]*basis[3]+c[2]*basis[6],
						atom.position[1]+c[0]*basis[1]+c[1]*basis[4]+c[2]*basis[7],
						atom.position[2]+c[0]*basis[2]+c[1]*basis[5]+c[2]*basis[8],
					]
				});
				this.addType.push(2);
			}
		}

		// Mark coincident atoms
		const fullCount = outAtoms.length;
		const tol = 1e-5;

		for(let i=0; i < fullCount-1; ++i) {
			if(this.addType[i] < 0) continue;
			for(let j=i+1; j < fullCount; ++j) {
				if(this.addType[j] < 0) continue;

				const fdx = outAtoms[i].position[0] - outAtoms[j].position[0];
				if(fdx < tol && fdx > -tol) {
					const fdy = outAtoms[i].position[1] - outAtoms[j].position[1];
					if(fdy < tol && fdy > -tol) {
						const fdz = outAtoms[i].position[2] - outAtoms[j].position[2];
						if(fdz < tol && fdz > -tol) {
							this.addType[j] = -1;
						}
					}
				}
			}
		}

		// Remove coincident atoms
		for(let i=fullCount-1; i >= 0; --i) {
			if(this.addType[i] < 0) {
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
	 *
	 * @param structure - The extended structure to be cleaned
	 */
	private clearOutsideAtoms(structure: Structure): void {

		const {bonds, atoms} = structure;

		// Get the list of atoms that have bonds
		const bondedAtoms = new Set<number>();
		for(const bond of bonds) {
			bondedAtoms.add(bond.from);
			bondedAtoms.add(bond.to);
		}

		// Mark the atoms that have bonds
		const natoms = atoms.length;
		for(let i=this.inputNumAtoms; i < natoms; ++i) {
			if(bondedAtoms.has(i)) this.addType[i] = 1;
		}

		// Create map of atoms indices after cleaning atoms list
		const mapPositions = Array(natoms).fill(0) as number[];
		let idx = 0;
		for(let i=0; i < natoms; ++i) {
			if(this.addType[i] === 1) mapPositions[i] = idx++;
		}

		// Remove not bonded outside atoms
		for(let i=natoms-1; i >=0; --i) {
			if(this.addType[i] === 2) atoms.splice(i, 1);
		}

		// Remap bonds
		for(const bond of bonds) {
			bond.from = mapPositions[bond.from];
			bond.to = mapPositions[bond.to];
		}
	}

	/**
	 * Recursively find the connected atoms
	 *
	 * @param bonds - The bonds part of the augmented structure
	 * @param startIdx - Starting index for the serie
	 */
	private markingConnected(bonds: Bond[], startIdx: number): void {

		for(const bond of bonds) {

			const {from, to, type} = bond;
			if(type !== 0) continue;
			if(from === startIdx) {
				if(this.addType[to] === 2) {
					this.addType[to] = 22;
					this.markingConnected(bonds, to);
				}
			}
			else if(to === startIdx && this.addType[from] === 2) {
				this.markingConnected(bonds, from);
				this.addType[from] = 22;
			}
		}
	}

	/**
	 * Start finding connected atoms outside the unit cell
	 *
	 * @param structure - The augmented structure with the 26 cell replicas
	 */
	private leaveConnectedAtoms(structure: Structure): void {

		// The starting points are the outside atoms connected to one inside atom
		for(const bond of structure.bonds) {

			const {from, to, type} = bond;
			if(type !== 0) continue;
			if(this.addType[from] === 1 && this.addType[to] === 2) {
				this.addType[to] = 22;
				this.markingConnected(structure.bonds, to);
			}
			else if(this.addType[to] === 1 && this.addType[from] === 2) {
				this.addType[from] = 22;
				this.markingConnected(structure.bonds, from);
			}
		}

		// Remove unneeded bonds
		for(let i=structure.bonds.length-1; i >= 0; --i) {
			const {from, to} = structure.bonds[i];
			if(this.addType[from] === 2 || this.addType[to] === 2) {
				structure.bonds.splice(i, 1);
			}
		}

		// Preparing the atoms index mapping before removing outside not connected atoms
		const mapIdx = new Map<number, number>();
		const len = this.addType.length;
		for(let i=0, j=0; i < len; ++i) {
			if(this.addType[i] === 1 || this.addType[i] === 22) {
				mapIdx.set(i, j);
				++j;
			}
		}

		// Remove unmarked atoms
		for(let i=len-1; i >= 0; --i) {
			if(this.addType[i] === 2) {
				this.addType.splice(i, 1);
				structure.atoms.splice(i, 1);
			}
		}

		// Remap indices of atoms in the bonds
		for(let i=structure.bonds.length-1; i >= 0; --i) {
			structure.bonds[i].from = mapIdx.get(structure.bonds[i].from)!;
			structure.bonds[i].to = mapIdx.get(structure.bonds[i].to)!;
		}
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

				const enlargedStructure = this.addOutsideAtoms();
				enlargedStructure.bonds = this.computeBonds(enlargedStructure);
				if(this.enlargementKind === "outside") this.clearOutsideAtoms(enlargedStructure);
				else this.leaveConnectedAtoms(enlargedStructure);
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
	 * The H bonds form when X___H...Y and X, Y are N, O, F (and also S)
	 *
	 * @param atomZ - Atomic number of the X or Y atoms
	 * @returns True if an H bond could form
	 */
	private atomForHBond(atomZ: number): boolean {return atomZForH.has(atomZ);}

	// > Compute the valence angle
	/**
	* Compute the valence angle. In X___H...Y the valence angle is HXY
	*
	* @param atomH - Hydrogen atom
	* @param atomX - Atom at one side
	* @param atomY - Atom at the other side
	* @returns Valence angle in degrees
	*/
	private valenceAngle(atomH: Atom, atomX: Atom, atomY: Atom): number {

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
		for(const atom of atoms) {
			const {atomZ} = atom;
			radii.push(getAtomData(atomZ).rCov);
		}

		// No bonds possible
		const atomsCount = atoms.length;
		if(atomsCount < 2) return [];

		// The computed bonds
		const bonds: Bond[] = [];

		const {maxHValenceAngle, minBondingDistance,
			   maxBondingDistance, maxHBondingDistance,
			   enlargementKind, addType} = this;

		// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
		const minDistanceSquared = minBondingDistance*minBondingDistance;

		// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
		const maxDistanceSquared = maxBondingDistance*maxBondingDistance;

		// Maximum distance for an H bond
		const maxDistanceHbondSquared = maxHBondingDistance*maxHBondingDistance;

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
				if(enlargementKind === "outside" && addType[i] === 2 && addType[j] === 2) continue;

				// Never bond hydrogens to each other...
				// if(atomZi === 1 && atomZj === 1) continue;

				// Compute distance between atoms
				const dx = positionI[0] - positionJ[0];
				const dy = positionI[1] - positionJ[1];
				const dz = positionI[2] - positionJ[2];

				// If atoms are distant along one axis, it is sure they cannot bind
				if(dx > maxBondingDistance || dy > maxBondingDistance || dz > maxBondingDistance) continue;

				// Check more precise limits
				const distSquared = dx*dx+dy*dy+dz*dz;
				if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

				// Get the distance for bonding
				const sumRcov = (rCi + rCj)*this.boundingScale(atomZi, atomZj);
				const sumRcovSquared = sumRcov*sumRcov;

				// Check for H-bond
				if(computeHBonds &&
				   ((atomZi === 1 && this.atomForHBond(atomZj)) ||
				    (atomZj === 1 && this.atomForHBond(atomZi))) &&
				   (distSquared <= maxDistanceHbondSquared) &&
				   (distSquared > sumRcovSquared)) {

					bonds.push({from: i, to: j, type: 1});
				}

				// Check for ordinary bond
				else if(distSquared <= sumRcovSquared) {
					bonds.push({from: i, to: j, type: 0});
				}
			}
		}

		// One H bond forms when X___H...Y where X, Y are N, O or F.
		// Here we check the angle HXY. It should be less than maxHValenceAngle (usually 30 deg.)
		const countBonds = bonds.length;
		for(let i=0; i < countBonds; ++i) {

			if(bonds[i].type !== 1) continue;

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

				if(bonds[j].type === 1 || bonds[j].type === 99) continue;

				if(bonds[j].from === idxH) {
					idxX = bonds[j].to;
					break;
				}
				if(bonds[j].to   === idxH) {
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

				bonds[i].type = distSquared <= sumCovSquared ? 0 : 99;

				continue;
			}

			const atomX = atoms[idxX];
			if(!this.atomForHBond(atomX.atomZ) ||
			   this.valenceAngle(atomH, atomX, atomY) > maxHValenceAngle) bonds[i].type = 99;
		}

		// Remove bonds between atoms that have too many bonds
		// this.removeOverBonding(bonds, atoms, addType);

		// Clean up bonds list removing invalid bonds
		const outBonds: Bond[] = [];
		for(let i=0; i < countBonds; ++i) {
			if(bonds[i].type !== 99) outBonds.push(bonds[i]);
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
		this.enlargementKind     = params.enlargementKind as string ?? "none";
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
		this.enlargementKind     = params.enlargementKind as string ?? "none";
		this.perPairData         = JSON.parse(params.perPairData as string ?? "[]") as PairData[];

		this.addBonds();
	}
}
