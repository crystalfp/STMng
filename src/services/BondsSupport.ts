/**
 * Support routines for bonds computation in prototype visualization.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-02
 */
import type {Bond, PrototypeAtomsData} from "@/types";
import {BondType} from "./SharedConstants";

const minBondingDistance  = 0.64;
const maxBondingDistance  = 4.50;
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
