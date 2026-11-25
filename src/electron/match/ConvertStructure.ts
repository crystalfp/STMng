/**
 * Convert structure to/from Pymatgen SNL format
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-11-23
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
import {readSync} from "node:fs";
import {inv} from "mathjs";
import {matrixToLattice} from "./Lattice";
import {getAtomicSymbol} from "../modules/AtomData";
import {hasNoUnitCell, invertBasis} from "../modules/Helpers";
import type {Structure} from "@/types";
import type {SNL, Site} from "./types";

/**
 * Convert structure to the format required by the code
 *
 * @param structure - STMng structure to be converted
 * @returns The structure in SNL format or undefined if it has no unit cell
 */
export const structureToSNL = (structure: Structure,
							   duplicates: boolean[]): SNL | undefined => {

	const {crystal, atoms} = structure;
	const {basis, origin} = crystal;

	if(hasNoUnitCell(basis)) return undefined;

	const matrix = [
		[basis[0], basis[1], basis[2]],
		[basis[3], basis[4], basis[5]],
		[basis[6], basis[7], basis[8]]
	];

	const lattice = matrixToLattice(matrix);

	// Compute inverse matrix
	const inverse = invertBasis(basis);

	// Convert each atom into site
	const sites: Site[] = [];
	let idx = 0;
	for(const {position, label, atomZ} of atoms) {

		if(duplicates[idx++]) continue;

		const cx = position[0] - origin[0];
		const cy = position[1] - origin[1];
		const cz = position[2] - origin[2];

		const abc = [cx*inverse[0] + cy*inverse[3] + cz*inverse[6],
						cx*inverse[1] + cy*inverse[4] + cz*inverse[7],
						cx*inverse[2] + cy*inverse[5] + cz*inverse[8]];

		sites.push({
			abc,
			xyz: [...position],
			label: label,
			species: [
				{element: getAtomicSymbol(atomZ), occu: 1}
			]
		});
	}

	return {
		sites,
		lattice
	};
};

export const dataToSNL = (fd: number, offset: number): SNL => {

	// Number of atoms
	const natomsBuffer = new Uint8Array(2);
	readSync(fd, natomsBuffer, 0, 2, offset);
	const natoms = natomsBuffer[1]*256+natomsBuffer[0];

	// Atom types
	const atomsZBuffer = new Uint8Array(natoms);
	readSync(fd, atomsZBuffer, 0, natoms, offset+2);

	// Basis and atoms coordinates
	const floatPart = new Float32Array(9+natoms*3);
	const floatLength = floatPart.byteLength;
	readSync(fd, floatPart, 0, floatLength, offset+2+natoms);

	const matrix = [
		[floatPart[0], floatPart[1], floatPart[2]],
		[floatPart[3], floatPart[4], floatPart[5]],
		[floatPart[6], floatPart[7], floatPart[8]]
	];

	const lattice = matrixToLattice(matrix);

	// Compute inverse matrix
	const inverse = inv(matrix);

	// Convert each atom into site
	const sites: Site[] = [];
	for(let i=0, j=9; i < natoms; ++i) {

		const cx = floatPart[j++];
		const cy = floatPart[j++];
		const cz = floatPart[j++];

		const abc = [cx*inverse[0][0] + cy*inverse[1][0] + cz*inverse[2][0],
					 cx*inverse[0][1] + cy*inverse[1][1] + cz*inverse[2][1],
					 cx*inverse[0][2] + cy*inverse[1][2] + cz*inverse[2][2]];

		const symbol = getAtomicSymbol(atomsZBuffer[i]);
		sites.push({
			abc,
			xyz: [cx, cy, cz],
			label: `${symbol} (${i})`,
			species: [
				{element: symbol, occu: 1}
			]
		});
	}
	return {lattice, sites};
};
