/**
 * Add bonds to the input structure.
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure, Atom, Bond} from "@/types";

// The H bonds form when X___H...Y and X, Y are N, O, F (maybe also S)
const atomForHBond = (atomZ: number): boolean => [7, 8, 9, 16].includes(atomZ);

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

	/**
	 * Create the node
	 *
	 * @param id - ID of the Draw Unit Cell node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

    		this.enableComputeBonds  = params.enableComputeBonds as boolean ?? true;

    		this.minBondingDistance  = params.minBondingDistance as number ?? 0.64;
    		this.maxBondingDistance  = params.maxBondingDistance as number ?? 4.50;
    		this.maxHBondingDistance = params.maxHBondingDistance as number ?? 3.00;
    		this.maxHValenceAngle    = params.maxHValenceAngle as number ?? 30;
    		this.bondScale    		 = params.bondScale as number ?? 1.1;

			this.addBonds();
		});

		sb.getData(this.id, (data: unknown) => {

			this.inputStructure = data as Structure;
			this.addBonds();
		});
	}

	private addBonds(): void {

		// If no input structure, output an empty structure
		if(!this.inputStructure?.atoms || this.inputStructure.atoms.length === 0) {

			this.outputEmptyStructure();
		}
		else if(this.enableComputeBonds) {

			const out: Structure = {
				crystal: this.inputStructure.crystal,
				atoms: this.inputStructure.atoms,
				bonds: this.computeBonds(),
				look: this.inputStructure.look,
				volume: this.inputStructure.volume
			};
			sb.setData(this.id, out);
		}
		else {

			sb.setData(this.id, this.inputStructure);
		}
	}

	private computeBonds(): Bond[] {

		const {atoms, look} = this.inputStructure!;

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

		const {maxHValenceAngle, minBondingDistance, maxBondingDistance, maxHBondingDistance, bondScale} = this;

		// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
		const minDistanceSquared = minBondingDistance*minBondingDistance;

		// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
		const maxDistanceSquared = maxBondingDistance*maxBondingDistance;

		// Maximum distance for an H bond
		const maxDistanceHbondSquared = maxHBondingDistance*maxHBondingDistance;

		// Maximum angle to form a H bond

		// Compute H bonds only if H atoms present
		const computeHBonds = atoms.some((atom) => {return atom.atomZ === 1;});

		// Visit each pair of atoms
		for(let i=atomsCount-2; i>= 0; --i) {

			const atomZi = atoms[i].atomZ;
			const rCi = radii[i];

			for(let j=i+1; j < atomsCount; ++j) {

				const atomZj = atoms[j].atomZ;
				const rCj = radii[j];

				// Never bond hydrogens to each other...
				if(atomZi === 1 && atomZj === 1) continue;

				// Compute distance between atoms
				const dx = atoms[i].position[0] - atoms[j].position[0];
				const dy = atoms[i].position[1] - atoms[j].position[1];
				const dz = atoms[i].position[2] - atoms[j].position[2];

				const distSquared = dx*dx+dy*dy+dz*dz;

				if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

				const sumRcov = (rCi + rCj)*bondScale;
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
		// Here we check the angle HXY. It should be less than 30 deg.
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

				const sumCov = rCH + rCY;
				const sumCovSquared = sumCov*sumCov;

				bonds[i].type = distSquared <= sumCovSquared ? "n" : "x";

				continue;
			}

			if(!atomForHBond(atoms[idxX].atomZ) ||
			   valenceAngle(atoms[idxH], atoms[idxX], atoms[idxY]) > maxHValenceAngle) bonds[i].type = "x";
		}

		// Clean up bond list removing invalid bonds
		for(let i = countBonds-1; i >= 0; --i) {

			if(bonds[i].type === "x") bonds.splice(i, 1);
		}

		return bonds;
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
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
