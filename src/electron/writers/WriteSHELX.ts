/**
 * Writer for Shel-X formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {openSync, writeSync, closeSync} from "node:fs";
import {reducingToFractionalCoordinates, basisToLengthAngles, format} from "../modules/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterSHELX implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {
		try {
			const fd = openSync(filename, "w");

			// Access the structure
			const {crystal} = structures[0];
			const {basis, spaceGroup} = crystal;

			// Comment line
    		writeSync(fd, "TITL Created by STMng\n");

			// Output the unit cell, if any
			if(basis.some((value: number) => value !== 0)) {

				const cell = basisToLengthAngles(basis);

				writeSync(fd,
						`CELL 1.54180 ${cell[0].toFixed(4)} ${cell[1].toFixed(4)} ${cell[2].toFixed(4)}` +
						` ${cell[3].toFixed(4)} ${cell[4].toFixed(4)} ${cell[5].toFixed(4)}\n`);
			}

			// Space group
			if(spaceGroup !== "") {

				if(spaceGroup.startsWith("(")) {

					const pos = spaceGroup.indexOf(")");
					writeSync(fd, `LATT ${spaceGroup.slice(1, pos)}\n`);
					const symms = spaceGroup.slice(pos+1).split("\n");
					for(const symm of symms) writeSync(fd, `SYMM ${symm}\n`);
				}
				else if("PpCcIiFfAa".includes(spaceGroup.at(0)!)) {
	    			writeSync(fd, `SYMM ${spaceGroup} (0)\n`);
				}
				else {
					const symms = spaceGroup.split("\n");
					for(const symm of symms) writeSync(fd, `SYMM ${symm}\n`);
				}
			}

			// Compute fractional coordinates removing duplicates
			const reduced = reducingToFractionalCoordinates(structures[0]);

    		// The SFAC line
			let line = "SFAC";
			for(const item of reduced.atomSymbols) {
				line += ` ${item}`;
			}
			line += "\nUNIT";

			// The counts
			for(const item of reduced.atomCount) {
				line += ` ${item}`;
			}
			line += "\n";
			writeSync(fd, line);

			// Atom specie indices
			const atomIndices = new Map<number, number>();
			let idx = 1;
			for(const atomZ of reduced.atomZ) {
				atomIndices.set(atomZ, idx);
				++idx;
			}

			// Output coordinates
			for(const atom of reduced.atoms) {
				const pos = atomIndices.get(atom.atomZ)!;
				const fc = atom.frac;
				writeSync(fd, `${atom.symbol.padEnd(4)} ${pos.toString().padEnd(4)} ` +
							  `${format(fc[0])} ${format(fc[1])} ` +
							  `${format(fc[2])}   11.00000   0\n`);
			}

			writeSync(fd, "END\n");
			closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {error: (error as Error).message};
		}
	}
}
