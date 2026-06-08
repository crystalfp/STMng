/**
 * Format entry from various accumulators as a POSCAR file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-01
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
import {getAtomicSymbol} from "./AtomData";
import {invertBasis} from "./Helpers";
import type {BasisType} from "@/types";

/** Essential info from the various accumulator entries */
interface SetEntry {

	/** Unit cell basis vectors */
	basis: BasisType;
	/** Atoms coordinates as [x1, y1, z1, x2, y2, z2, ...] */
	atomsPosition: number[];
	/** Atomic numbers of the structure atoms */
	atomsZ: number[];
}

/**
 * Format entry as POSCAR file
 *
 * @param entry - A single structure
 * @param comment - Comment line
 * @returns Content of the POSCAR file
 */
export const entryToPoscar = (entry: SetEntry, comment: string): string => {

	// Comment line
	let out = `${comment}\n1.0\n`;

	// Basis vectors
	const basisString = Array<string>(9);
	for(let i=0; i < 9; ++i) {
		basisString[i] = entry.basis[i].toFixed(10).padStart(15);
	}

	out += `${basisString[0]} ${basisString[1]} ${basisString[2]}\n`;
	out += `${basisString[3]} ${basisString[4]} ${basisString[5]}\n`;
	out += `${basisString[6]} ${basisString[7]} ${basisString[8]}\n`;

	// Summary of species and their count
	const species = new Map<number, number>();

	for(const z of entry.atomsZ) {
		const n = species.get(z);
		species.set(z, n ? n+1 : 1);
	}
	out += species.keys().map((z) => getAtomicSymbol(z)).toArray().join(" ") + "\n";
	out += species.values().map((value) => value.toFixed(0)).toArray().join(" ");
	out += "\nDirect\n";

	// Compute inverse matrix
	const inverse = invertBasis(entry.basis);

	// For each specie
	for(const atomZ of species.keys()) {
		for(let i=0; i < entry.atomsZ.length; ++i) {

			if(entry.atomsZ[i] !== atomZ) continue;

			// For each atom compute the fractional coordinates
			const i3 = i*3;
			const cx = entry.atomsPosition[i3];
			const cy = entry.atomsPosition[i3+1];
			const cz = entry.atomsPosition[i3+2];

			const fx = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			const fy = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			const fz = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

			out += `${fx.toFixed(10).padStart(15)} ` +
				   `${fy.toFixed(10).padStart(15)} ` +
				   `${fz.toFixed(10).padStart(15)}\n`;
		}
	}

	return out;
};
