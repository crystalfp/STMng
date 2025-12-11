/**
 * Support routines for bonds computation in prototype visualization.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-02
 */
import type {Bond, PrototypeAtomsData} from "@/types";
import {displacementCoefficients, type AddKind,
		AddType, BondType} from "./SharedConstants";

/**
 * Add atoms from the 26 cells around the given cell
 *
 * @returns Structure with added adjacent atoms
 */
export const addOutsideAtoms = (matrix: number[][], atoms: PrototypeAtomsData): PrototypeAtomsData => {

	const natoms = atoms.labels.length;

	// Add the input atoms
	const outAtoms: PrototypeAtomsData = structuredClone(atoms);

	// The first atoms are the ones inside the unit cell
	outAtoms.addType = Array<AddKind>(natoms).fill(AddType.inside);

	// Add adjacent atoms (don't use for...of)
	for(let i=0; i < natoms; ++i) {

		const i3 = 3*i;

		for(const c of displacementCoefficients) {

			outAtoms.positions.push(
				atoms.positions[i3]  +c[0]*matrix[0][0]+c[1]*matrix[1][0]+c[2]*matrix[2][0],
				atoms.positions[i3+1]+c[0]*matrix[0][1]+c[1]*matrix[1][1]+c[2]*matrix[2][1],
				atoms.positions[i3+2]+c[0]*matrix[0][2]+c[1]*matrix[1][2]+c[2]*matrix[2][2],
			);
			outAtoms.labels.push(atoms.labels[i]);
			outAtoms.radius.push(atoms.radius[i]);
			outAtoms.color.push(atoms.color[i]);
			outAtoms.addType.push(AddType.outside);
		}
	}

	// Remove external atoms coincident with internal ones
	const fullCount = outAtoms.radius.length;
	const TOL = 1e-3;
	for(let i=0; i < natoms; ++i) {
		for(let j=natoms; j < fullCount; ++j) {
			if(outAtoms.addType[j] === AddType.removed) continue;

			const dx = outAtoms.positions[3*i] - outAtoms.positions[3*j];
			if(dx < TOL && dx > -TOL) {
				const dy = outAtoms.positions[3*i+1] - outAtoms.positions[3*j+1];
				if(dy < TOL && dy > -TOL) {
					const dz = outAtoms.positions[3*i+2] - outAtoms.positions[3*j+2];
					if(dz < TOL && dz > -TOL) {
						outAtoms.addType[j] = AddType.removed;
					}
				}
			}
		}
	}

	// Mark coincident external atoms
	for(let i=natoms; i < fullCount-1; ++i) {
		if(outAtoms.addType[i] === AddType.removed) continue;
		for(let j=i+1; j < fullCount; ++j) {
			if(outAtoms.addType[j] === AddType.removed) continue;

			const dx = outAtoms.positions[3*i] - outAtoms.positions[3*j];
			if(dx < TOL && dx > -TOL) {
				const dy = outAtoms.positions[3*i+1] - outAtoms.positions[3*j+1];
				if(dy < TOL && dy > -TOL) {
					const dz = outAtoms.positions[3*i+2] - outAtoms.positions[3*j+2];
					if(dz < TOL && dz > -TOL) {
						outAtoms.addType[j] = AddType.removed;
					}
				}
			}
		}
	}

	// Remove coincident atoms
	for(let i=fullCount-1; i >= 0; --i) {
		if(outAtoms.addType[i] === AddType.removed) {
			outAtoms.addType.splice(i, 1);
			outAtoms.positions.splice(i*3, 3);
			outAtoms.labels.splice(i, 1);
			outAtoms.radius.splice(i, 1);
			outAtoms.color.splice(i, 1);
		}
	}

	return outAtoms;
};

const minBondingDistance  = 0.64;
const maxBondingDistance  = 4.50;
// const enlargementKind     = "neighbors";
const bondingScale        = 1.1;

/**
 * Compute bonds for the given structure
 *
 * @returns Computed bonds list
 */
export const computeBonds = (structure: PrototypeAtomsData): Bond[] => {

	const {radius, positions} = structure;

	// No bonds possible
	const atomsCount = radius.length;
	if(atomsCount < 2) return [];

	// The computed bonds
	const bonds: Bond[] = [];

	// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
	const minDistanceSquared = minBondingDistance*minBondingDistance;

	// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
	const maxDistanceSquared = maxBondingDistance*maxBondingDistance;

	// Visit each pair of atoms
	for(let i=atomsCount-2; i>= 0; --i) {

		const rCi = radius[i];

		for(let j=i+1; j < atomsCount; ++j) {

			const rCj = radius[j];

			// Don't compute bonds between external atoms
			// if(enlargementKind === "neighbors" &&
			//    addType![i] === AddType.outside &&
			//    addType![j] === AddType.outside) continue;

			// Compute distance between atoms
			const dx = positions[3*i+0] - positions[3*j+0];
			const dy = positions[3*i+1] - positions[3*j+1];
			const dz = positions[3*i+2] - positions[3*j+2];

			// If atoms are distant along one axis, it is sure they cannot bind
			if(dx > maxBondingDistance || dy > maxBondingDistance || dz > maxBondingDistance) continue;

			// Check more precise limits
			const distSquared = dx*dx+dy*dy+dz*dz;
			if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

			// Get the distance for bonding
			const sumRcov = (rCi + rCj)*bondingScale;
			const sumRcovSquared = sumRcov*sumRcov;

			// Check for ordinary bond
			if(distSquared <= sumRcovSquared) {
				bonds.push({from: i, to: j, type: BondType.normal});
			}
		}
	}

	return bonds;
};

/**
 *  Remove added atoms that are not bonded to inside atoms
 *
 * @param structure - The extended structure to be cleaned
 */
export const clearOutsideAtoms = (structure: PrototypeAtomsData, bonds: Bond[], inside: number): void => {

	// Get the list of atoms that have bonds
	const bondedAtoms = new Set<number>();
	for(const bond of bonds) {
		bondedAtoms.add(bond.from);
		bondedAtoms.add(bond.to);
	}

	// Mark the atoms that have bonds
	const natoms = structure.radius.length;
	for(let i=inside; i < natoms; ++i) {
		if(bondedAtoms.has(i)) structure.addType![i] = AddType.inside;
	}

	// Create map of atoms indices after cleaning atoms list
	const mapPositions = Array<number>(natoms).fill(0);
	let idx = 0;
	for(let i=0; i < natoms; ++i) {
		if(structure.addType![i] === AddType.inside) mapPositions[i] = idx++;
	}

	// Remove not bonded outside atoms
	for(let i=natoms-1; i >=0; --i) {
		if(structure.addType![i] === AddType.outside) {

			structure.addType!.splice(i, 1);
			structure.positions.splice(i*3, 3);
			structure.labels.splice(i, 1);
			structure.radius.splice(i, 1);
			structure.color.splice(i, 1);
		}
	}

	// Remap bonds
	for(const bond of bonds) {
		bond.from = mapPositions[bond.from];
		bond.to = mapPositions[bond.to];
	}
};
