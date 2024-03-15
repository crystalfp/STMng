/**
 * Add bonds to the input structure.
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure, Atom, Bond} from "@/types";

/** Data for the per atom pair multiplier of the sum of covalent radii */
interface PairData {
    label: string;
	atomZi: number;
	atomZj: number;
    scale: number;
}

/** Multiplicative coefficients for basis to get atoms adjacent to the unit cell */
const displacementCoefficients = [

	[1, 0, 0], // Z = 0
	[1, 1, 0],
	[1, -1, 0],

	[-1, 0, 0],
	[-1, 1, 0],
	[-1, -1, 0],

	[0, 1, 0], // [0, 0, 0] is obviously missing
	[0, -1, 0],

	[0, 0, 1], // Z = 1
	[0, 1, 1],
	[0, -1, 1],

	[-1, 0, 1],
	[-1, 1, 1],
	[-1, -1, 1],

	[1, 0, 1],
	[1, 1, 1],
	[1, -1, 1],

	[0, 0, -1], // Z = -1
	[0, 1, -1],
	[0, -1, -1],

	[-1, 0, -1],
	[-1, 1, -1],
	[-1, -1, -1],

	[1, 0, -1],
	[1, 1, -1],
	[1, -1, -1],
];

// The H bonds form when X___H...Y and X, Y are N, O, F (maybe also S)
const atomForHBond = (atomZ: number): boolean => [7, 8, 9, 16].includes(atomZ);

// > Compute the valence angle
/**
 * Compute the valence angle. In X___H...Y the valence angle is HXY
 *
 * @param atomH - Hydrogen atom
 * @param atomX - Atom at one side
 * @param atomY - Atom at the other side
 * @returns Valence angle in degrees
 */
const valenceAngle = (atomH: Atom, atomX: Atom, atomY: Atom): number => {

	const v0 = atomH.position[0] - atomX.position[0];
	const w0 = atomY.position[0] - atomX.position[0];
	const v1 = atomH.position[1] - atomX.position[1];
	const w1 = atomY.position[1] - atomX.position[1];
	const v2 = atomH.position[2] - atomX.position[2];
	const w2 = atomY.position[2] - atomX.position[2];

	const dotProduct = v0*w0 + v1*w1 + v2*w2;
	const lv2 = v0*v0 + v1*v1 + v2*v2;
	const lw2 = w0*w0 + w1*w1 + w2*w2;

	return Math.acos(dotProduct/Math.sqrt(lv2*lw2))*180/Math.PI;
};

export class ComputeBonds {

	private inputStructure: Structure | undefined;

	private minBondingDistance  = 0.64;
	private maxBondingDistance  = 4.50;
	private maxHBondingDistance = 3.00;
	private maxHValenceAngle    = 30;
	private enableComputeBonds  = true;
	private bondScale           = 1.1;
	private perPairScale		= false;
	private perPairData: PairData[] = [];
	private enlargeCell         = false;
	private addType: number[]   = []; // 1: atom in unit cell; 2: atom outside unit cell
	private inputNumAtoms		= 0;

	// > Create the node
	/**
	 * Create the node
	 *
	 * @param id - ID of the Compute Bonds node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.enableComputeBonds  = params.enableComputeBonds as boolean ?? true;

    		this.minBondingDistance  = params.minBondingDistance as number ?? 0.64;
    		this.maxBondingDistance  = params.maxBondingDistance as number ?? 4.50;
    		this.maxHBondingDistance = params.maxHBondingDistance as number ?? 3.00;
    		this.maxHValenceAngle    = params.maxHValenceAngle as number ?? 30;
    		this.bondScale    		 = params.bondScale as number ?? 1.1;
			this.perPairScale		 = params.perPairScale as boolean ?? false;
			this.enlargeCell	     = params.enlargeCell as boolean ?? false;

			this.perPairData = JSON.parse(params.perPairData as string ?? "[]") as PairData[];

			this.addBonds();
		});

		sb.getData(this.id, (data: unknown) => {

			this.inputStructure = data as Structure;

			this.createPairData();

			sb.setUiParams(this.id, {
				perPairData: JSON.stringify(this.perPairData)
			});

			this.addBonds();
		});
	}

	// > Create the table of per atom pair multiplier
	/**
	 * Create the table of per atom pair multiplier of the sum of covalent radii
	 */
	private createPairData(): void {

		// Get the structure atoms
		if(!this.inputStructure?.look || this.inputStructure.atoms.length === 0) {
			this.perPairData = [];
			return;
		}
		const {look} = this.inputStructure;

		// Remove previous entries not existing in the current structure
		let len = this.perPairData.length;
		for(let i=len-1; i >= 0; --i) {
			if(!look[this.perPairData[i].atomZi] || !look[this.perPairData[i].atomZj]) {
				this.perPairData.splice(i, 1);
			}
		}

		// Get the type of atoms in the structure
		const z: number[] = [];
		for(const atomZ in look) z.push(Number.parseInt(atomZ));

		// Add missing pairs
		len = z.length;
		for(let i=0; i < len; ++i) {
			for(let j=i; j < len; ++j) {

				if(z[i] === 1 && z[j] === 1) continue;

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
						label: `${look[z[i]].symbol} – ${look[z[j]].symbol}`,
						atomZi: z[i],
						atomZj: z[j],
						scale: 1.1
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
		const {crystal, atoms, look, volume} = this.inputStructure!;
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

		return {
			crystal,
			atoms: outAtoms,
			bonds: [],
			look,
			volume
		};
	}

	// > Clear outside atoms
	/**
	 *  added that are not bonded to inside atoms
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

	// > Add bonds to output structure
	/**
	 * Add bonds to output structure
	 */
	private addBonds(): void {

		// If no input structure, output an empty structure
		if(!this.inputStructure?.atoms || this.inputStructure.atoms.length === 0) {

			this.outputEmptyStructure();
		}
		else if(this.enableComputeBonds) {

			if(this.enlargeCell) {

				// If no unit cell, do nothing
				if(this.inputStructure.crystal.basis.every((value) => value === 0)) {
					sb.setData(this.id, this.inputStructure);
					return;
				}

				const enlargedStructure = this.addOutsideAtoms();
				enlargedStructure.bonds = this.computeBonds(enlargedStructure);
				this.clearOutsideAtoms(enlargedStructure);
				sb.setData(this.id, enlargedStructure);
			}
			else {
				const out: Structure = {
					crystal: this.inputStructure.crystal,
					atoms: this.inputStructure.atoms,
					bonds: this.computeBonds(this.inputStructure),
					look: this.inputStructure.look,
					volume: this.inputStructure.volume
				};
				sb.setData(this.id, out);
			}
		}
		else {

			sb.setData(this.id, this.inputStructure);
		}
	}

	// > Compute bonds
	/**
	 * Compute bonds for the given structure
	 *
	 * @returns Computed bonds list
	 */
	private computeBonds(structure: Structure): Bond[] {

		const {atoms, look} = structure;

		const radii: number[] = [];
		for(const atom of atoms) {
			const {atomZ} = atom;
			radii.push(look[atomZ].rCov);
		}

		// No bonds possible
		const atomsCount = atoms.length;
		if(atomsCount < 2) return [];

		// The computed bonds
		const bonds: Bond[] = [];

		const {maxHValenceAngle, minBondingDistance, maxBondingDistance, maxHBondingDistance} = this;

		// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
		const minDistanceSquared = minBondingDistance*minBondingDistance;

		// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
		const maxDistanceSquared = maxBondingDistance*maxBondingDistance;

		// Maximum distance for an H bond
		const maxDistanceHbondSquared = maxHBondingDistance*maxHBondingDistance;

		// Maximum angle to form a H bond (already in maxHValenceAngle)

		// Compute H bonds only if H atoms present
		const computeHBonds = atoms.some((atom) => {return atom.atomZ === 1;});

		// Visit each pair of atoms
		for(let i=atomsCount-2; i>= 0; --i) {

			const atomZi = atoms[i].atomZ;
			const rCi = radii[i];

			for(let j=i+1; j < atomsCount; ++j) {

				const atomZj = atoms[j].atomZ;
				const rCj = radii[j];

				// Don't compute bonds between external atoms
				const {enlargeCell, addType} = this;
				if(enlargeCell && addType[i] === 2 && addType[j] === 2) continue;

				// Never bond hydrogens to each other...
				if(atomZi === 1 && atomZj === 1) continue;

				// Compute distance between atoms
				const dx = atoms[i].position[0] - atoms[j].position[0];
				const dy = atoms[i].position[1] - atoms[j].position[1];
				const dz = atoms[i].position[2] - atoms[j].position[2];

				const distSquared = dx*dx+dy*dy+dz*dz;

				if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

				const sumRcov = (rCi + rCj)*this.boundingScale(atomZi, atomZj);
				const sumRcovSquared = sumRcov*sumRcov;

				// Check for H-bond
				if(computeHBonds &&
				   ((atomZi === 1 && atomForHBond(atomZj)) || (atomZj === 1 && atomForHBond(atomZi))) &&
				   (distSquared <= maxDistanceHbondSquared) && (distSquared > sumRcovSquared)) {

					bonds.push({from: i, to: j, type: "h"});
				}

				// Check for ordinary bond
				else if(distSquared <= sumRcovSquared) {
					bonds.push({from: i, to: j, type: "n"});
				}
			}
		}

		// One H bond forms when X___H...Y where X, Y are N, O or F.
		// Here we check the angle HXY. It should be less than maxHValenceAngle (usually 30 deg.)
		const countBonds = bonds.length;
		for(let i=0; i < countBonds; ++i) {

			if(bonds[i].type !== "h") continue;

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

				if(bonds[j].type === "h" || bonds[j].type === "x") continue;

				if(bonds[j].from === idxH) {idxX = bonds[j].to;   break;}
				if(bonds[j].to   === idxH) {idxX = bonds[j].from; break;}
			}

			// If H is not bond to X recompute bond as ordinary bond or remove it
			if(idxX === undefined) {

				// Recompute distance
				const dx = atoms[idxH].position[0] - atoms[idxY].position[0];
				const dy = atoms[idxH].position[1] - atoms[idxY].position[1];
				const dz = atoms[idxH].position[2] - atoms[idxY].position[2];

				const distSquared = dx*dx+dy*dy+dz*dz;

				const rCH = radii[idxH];
				const rCY = radii[idxY];

				const sumCov = (rCH + rCY)*this.boundingScale(atoms[idxH].atomZ, atoms[idxY].atomZ);
				const sumCovSquared = sumCov*sumCov;

				bonds[i].type = distSquared <= sumCovSquared ? "n" : "x";

				continue;
			}

			if(!atomForHBond(atoms[idxX].atomZ) ||
			   valenceAngle(atoms[idxH], atoms[idxX], atoms[idxY]) > maxHValenceAngle) bonds[i].type = "x";
		}

		// Clean up bonds list removing invalid bonds
		for(let i = countBonds-1; i >= 0; --i) {

			if(bonds[i].type === "x") bonds.splice(i, 1);
		}

		return bonds;
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

	// > Output an empty structure
	/**
	 * Output an empty structure
	 */
	private outputEmptyStructure(): void {

		sb.setData(this.id, {
			crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: ""
			},
			atoms: [],
			bonds: [],
			look: {},
			volume: []
		});
	}

	// > Save the node status
	/**
	 * Save the node status
	 *
	 * @returns Entry as JSON of the node status for saving
	 */
	saveStatus(): string {

		const statusToSave = {
			minBondingDistance:  this.minBondingDistance,
			maxBondingDistance:  this.maxBondingDistance,
			maxHBondingDistance: this.maxHBondingDistance,
			maxHValenceAngle:    this.maxHValenceAngle,
			bondScale:			 this.bondScale,
			perPairScale: 		 this.perPairScale,
			enlargeCell:	 	 this.enlargeCell
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
