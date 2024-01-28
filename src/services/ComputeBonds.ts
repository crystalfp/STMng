/**
 * Compute structure bonds.
 *
 * @packageDocumentation
 */
import type {Atom, Bond} from "@/types";

// The H bonds forms when X___H...Y and X, Y are N, O, F (maybe also S)
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

/**
 * Compute bonds for a given structure
 *
 * @param atoms - Atoms for which the bonds should be computed
 * @param radii - Covalent radius for each atom
 * @returns The list of computed bonds
 */
export const computeBonds = (atoms: Atom[], radii: number[]): Bond[] => {

	// No bonds possible
	if(atoms.length < 2) return [];

	// The computed bonds
	const bonds: Bond[] = [];

	// Minimum covalent radius is 0.32 for He, so no bond shorter than .64 could exist
	const minDistance = 0.64;
	const minDistanceSquared = minDistance*minDistance;

	// Maximum covalent radius is 2.25 for Cs, so no bonds longer than 4.50 could exist
	const maxDistance = 4.5;
	const maxDistanceSquared = maxDistance*maxDistance;

	// Maximum distance for an H bond
	const maxDistanceHbond = 3.0;
	const maxDistanceHbondSquared = maxDistanceHbond*maxDistanceHbond;

	// Maximum angle to form a H bond
	const maxHValenceAngle = 30;

	// Compute H bonds only if H atoms present
	const computeHBonds = atoms.some((atom) => {return atom.atomZ === 1;});

	// Visit each pair of atoms
	const len = atoms.length;
	for(let i=len-2; i>= 0; --i) {

		const atomZi = atoms[i].atomZ;
		const rCi = radii[i];
		// const rCi = getAtomicRadiiAndColor(atomZi).rCov;

		for(let j=i+1; j < len; ++j) {

			const atomZj = atoms[j].atomZ;
			const rCj = radii[j];
			// const rCj = getAtomicRadiiAndColor(atomZj).rCov;

			// Never bond hydrogens to each other...
			if(atomZi === 1 && atomZj === 1) continue;

			// Compute distance between atoms
			const dx = atoms[i].position[0] - atoms[j].position[0];
			const dy = atoms[i].position[1] - atoms[j].position[1];
			const dz = atoms[i].position[2] - atoms[j].position[2];

			const distSquared = dx*dx+dy*dy+dz*dz;

			if(distSquared < minDistanceSquared || distSquared > maxDistanceSquared) continue;

			const sumRcov = rCi + rCj;
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
			// const rCH = getAtomicRadiiAndColor(idxH).rCov;
			// const rCY = getAtomicRadiiAndColor(idxY).rCov;

			const sumCov = rCH + rCY;
			const sumCovSquared = sumCov*sumCov;

			bonds[i].type = distSquared <= sumCovSquared ? "n" : "x";

			continue;
		}

		if(!atomForHBond(atoms[idxX].atomZ) ||
		   valenceAngle(atoms[idxH], atoms[idxX], atoms[idxY]) > maxHValenceAngle) bonds[i].type = "x";
	}


	// Clean up bond list removing invalid H-bonds
	for(let i = countBonds-1; i >= 0; --i) {

		if(bonds[i].type === "x") {
			bonds.splice(i, 1);
		}
	}

	return bonds;
};
