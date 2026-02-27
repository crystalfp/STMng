/**
 * Mark atoms of the structure that should be ignored because
 * are duplicates or outside the unit cell
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-17
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
import type {Atom, Crystal} from "@/types";
import {invertBasis} from "./Helpers";

/**
 * Mark atoms of the input structure that should be ignored because
 * are duplicates or outside the unit cell
 *
 * @param atoms - Input structure atoms
 * @param crystal - Input structure crystal data
 * @returns The excluded markers (one per atom)
 */
export const markDuplicates = (atoms: Atom[], crystal: Crystal): boolean[] => {

	const {basis, origin} = crystal;
	const natoms = atoms.length;
	const TOL = 1e-5;

	const inverse = invertBasis(basis);
	const frac: number[][] = [];
	const excluded = Array<boolean>(natoms).fill(false);

	for(let i=0; i < natoms; ++i) {

		const {position} = atoms[i];

		const cx = position[0] - origin[0];
		const cy = position[1] - origin[1];
		const cz = position[2] - origin[2];

		const fx = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
		const fy = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
		const fz = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

		if(fx < 0 || fx > 1 || fy < 0 || fy > 1 || fz < 0 || fz > 1) {
			excluded[i] = true;
		}

		frac.push([fx, fy, fz]);
	}

	// Remove atoms on the opposite sides of the cell
	for(let i=0; i < natoms-1; ++i) {

		if(excluded[i]) continue;

		const li =[
			frac[i][0] < TOL || frac[i][0] > 1-TOL,
			frac[i][1] < TOL || frac[i][1] > 1-TOL,
			frac[i][2] < TOL || frac[i][2] > 1-TOL,
		];
		const liAny = li[0] || li[1] || li[2];

		for(let j=i+1; j < natoms; ++j) {

			if(excluded[j]) continue;

			const dx = Math.abs(frac[i][0] - frac[j][0]);
			const dy = Math.abs(frac[i][1] - frac[j][1]);
			const dz = Math.abs(frac[i][2] - frac[j][2]);

			const ld = [
				dx < TOL,
				dy < TOL,
				dz < TOL
			];
			if(ld[0] && ld[1] && ld[2]) excluded[j] = true;
			else if(!liAny) continue;

			const lj =[
				frac[j][0] < TOL || frac[j][0] > 1-TOL,
				frac[j][1] < TOL || frac[j][1] > 1-TOL,
				frac[j][2] < TOL || frac[j][2] > 1-TOL,
			];
			const ljAny = lj[0] || lj[1] || lj[2];
			if(!ljAny) continue;

			excluded[j] = checkCorrespondence(li, lj, ld);
		}
	}

	return excluded;
};

/**
 * Check if two atoms are in reality the same atom
 *
 * @param li - If atom "i" is on the border (for each axis)
 * @param lj - If atom "j" is on the border (for each axis)
 * @param ld - If coordinates coincide (for each axis)
 * @returns True if the two atoms are crystallographic correspondents
 */
const checkCorrespondence = (li: boolean[], lj: boolean[], ld: boolean[]): boolean => {

	// On the corners
	if(li[0] && li[1] && li[2] && lj[0] && lj[1] && lj[2]) return true;

	// On the edges
	if(li[0] && li[1] && lj[0] && lj[1] && ld[2]) return true;
	if(li[0] && li[2] && lj[0] && lj[2] && ld[1]) return true;
	if(li[1] && li[2] && lj[1] && lj[2] && ld[0]) return true;

	// On the facies
	if(li[0] && lj[0] && ld[1] && ld[2]) return true;
	if(li[1] && lj[1] && ld[0] && ld[2]) return true;
	if(li[2] && lj[2] && ld[0] && ld[1]) return true;

	return false;
};
