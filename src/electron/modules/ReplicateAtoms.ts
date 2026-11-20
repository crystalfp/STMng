/**
 * Replicate atoms on the boundary of the unit cell
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-20
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
*/
// > Kind of directions for filling unit cell
const X_MIN = 0x010;
const Y_MIN = 0x020;
const Z_MIN = 0x040;
const X_MAX = 0x080;
const Y_MAX = 0x100;
const Z_MAX = 0x200;
const X_ANY = 0x001;
const Y_ANY = 0x002;
const Z_ANY = 0x004;

/**
 * Replicate atoms on the boundary of the unit cell
 *
 * @param fc - Fractional coordinates of the atoms
 * @param margin - Tolerance to find the atoms on the boundaries
 * @returns Mapping atom index to the new one or empty array if no atom is replicated
 */
export const replicateAtoms = (fc: number[], margin: number): number[] => {

	const natoms = fc.length/3;
	const idx = Array<number>(natoms);
	const direction = Array<number>(natoms).fill(0);

	for(let i=0, k=0; i < natoms; ++i, k+=3) {

		const xf = fc[k];
		const yf = fc[k+1];
		const zf = fc[k+2];

		// Mark atoms exactly on the border
		if(xf < margin && xf > -margin)			direction[i]  = X_MIN|X_ANY;
		else if(xf > 1-margin && xf < 1+margin)	direction[i]  = X_MAX|X_ANY;
		if(yf < margin && yf > -margin)			direction[i] |= Y_MIN|Y_ANY;
		else if(yf > 1-margin && yf < 1+margin)	direction[i] |= Y_MAX|Y_ANY;
		if(zf < margin && zf > -margin)			direction[i] |= Z_MIN|Z_ANY;
		else if(zf > 1-margin && zf < 1+margin)	direction[i] |= Z_MAX|Z_ANY;

		idx[i] = i;
	}

	// No atoms to add. Do nothing
	if(direction.every((value) => value === 0)) return [];

	// Replicate the original atoms
	for(let i=0, k=0; i < natoms; ++i, k+=3) {

		const dir = direction[i];

		if(dir === 0) continue;

		switch(dir & (X_ANY|Y_ANY|Z_ANY)) {

		case X_ANY:
			fc.push(dir & X_MIN ? 1 : 0, fc[k+1], fc[k+2]);
			idx.push(i);
			break;

		case Y_ANY:
			fc.push(fc[k], dir & Y_MIN ? 1 : 0, fc[k+2]);
			idx.push(i);
			break;

		case Z_ANY:
			fc.push(fc[k], fc[k+1], dir & Z_MIN ? 1 : 0);
			idx.push(i);
			break;

		case X_ANY|Y_ANY:
			if((dir & (X_MIN|Y_MIN)) !== (X_MIN|Y_MIN)) {
				fc.push(0, 0, fc[k+2]);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MIN)) !== (X_MAX|Y_MIN)) {
				fc.push(1, 0, fc[k+2]);
				idx.push(i);
			}
			if((dir & (X_MIN|Y_MAX)) !== (X_MIN|Y_MAX)) {
				fc.push(0, 1, fc[k+2]);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MAX)) !== (X_MAX|Y_MAX)) {
				fc.push(1, 1, fc[k+2]);
				idx.push(i);
			}
			break;

		case X_ANY|Z_ANY:
			if((dir & (X_MIN|Z_MIN)) !== (X_MIN|Z_MIN)) {
				fc.push(0, fc[k+1], 0);
				idx.push(i);
			}
			if((dir & (X_MAX|Z_MIN)) !== (X_MAX|Z_MIN)) {
				fc.push(1, fc[k+1], 0);
				idx.push(i);
			}
			if((dir & (X_MIN|Z_MAX)) !== (X_MIN|Z_MAX)) {
				fc.push(0, fc[k+1], 1);
				idx.push(i);
			}
			if((dir & (X_MAX|Z_MAX)) !== (X_MAX|Z_MAX)) {
				fc.push(1, fc[k+1], 1);
				idx.push(i);
			}
			break;

		case Y_ANY|Z_ANY:
			if((dir & (Y_MIN|Z_MIN)) !== (Y_MIN|Z_MIN)) {
				fc.push(fc[k], 0, 0);
				idx.push(i);
			}
			if((dir & (Y_MAX|Z_MIN)) !== (Y_MAX|Z_MIN)) {
				fc.push(fc[k], 1, 0);
				idx.push(i);
			}
			if((dir & (Y_MIN|Z_MAX)) !== (Y_MIN|Z_MAX)) {
				fc.push(fc[k], 0, 1);
				idx.push(i);
			}
			if((dir & (Y_MAX|Z_MAX)) !== (Y_MAX|Z_MAX)) {
				fc.push(fc[k], 1, 1);
				idx.push(i);
			}
			break;

		case X_ANY|Y_ANY|Z_ANY:
			if((dir & (X_MIN|Y_MIN|Z_MIN)) !== (X_MIN|Y_MIN|Z_MIN)) {
				fc.push(0, 0, 0);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MIN|Z_MIN)) !== (X_MAX|Y_MIN|Z_MIN)) {
				fc.push(1, 0, 0);
				idx.push(i);
			}
			if((dir & (X_MIN|Y_MAX|Z_MIN)) !== (X_MIN|Y_MAX|Z_MIN)) {
				fc.push(0, 1, 0);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MAX|Z_MIN)) !== (X_MAX|Y_MAX|Z_MIN)) {
				fc.push(1, 1, 0);
				idx.push(i);
			}
			if((dir & (X_MIN|Y_MIN|Z_MAX)) !== (X_MIN|Y_MIN|Z_MAX)) {
				fc.push(0, 0, 1);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MIN|Z_MAX)) !== (X_MAX|Y_MIN|Z_MAX)) {
				fc.push(1, 0, 1);
				idx.push(i);
			}
			if((dir & (X_MIN|Y_MAX|Z_MAX)) !== (X_MIN|Y_MAX|Z_MAX)) {
				fc.push(0, 1, 1);
				idx.push(i);
			}
			if((dir & (X_MAX|Y_MAX|Z_MAX)) !== (X_MAX|Y_MAX|Z_MAX)) {
				fc.push(1, 1, 1);
				idx.push(i);
			}
			break;
		}
	}
	return idx;
};
