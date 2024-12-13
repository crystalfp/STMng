/**
 * Writer for Shel-X formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import {openSync, writeSync, closeSync} from "node:fs";
import {getAtomicSymbol} from "../modules/AtomData";
import {cartesianToFractionalCoordinates, basisToLengthAngles, format} from "../modules/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterSHELX implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {
		try {
			const fd = openSync(filename, "w");

			// Access the structure
			const {crystal, atoms} = structures[0];
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

			// Atom counts and indices
			const atomCounts = new Map<number, number>();
			for(const atom of atoms) {

				const count = atomCounts.get(atom.atomZ);
				atomCounts.set(atom.atomZ, count ? count+1 : 1);
			}
			const atomIndices = new Map<number, number>();
			let idx = 1;
			for(const item of atomCounts) {
				atomIndices.set(item[0], idx);
				++idx;
			}

    		// The SFAC line
			let line = "SFAC";
			for(const item of atomCounts) {
				line += ` ${getAtomicSymbol(item[0])}`;
			}
			line += "\n";
			writeSync(fd, line);

			// The counts
			line = "UNIT";
			for(const item of atomCounts) {
				line += ` ${item[1]}`;
			}
			line += "\n";
			writeSync(fd, line);

			// Output coordinates
			const fc = cartesianToFractionalCoordinates(structures[0]);

			idx = 0;
			for(const atom of atoms) {
				const name = getAtomicSymbol(atom.atomZ);
				const pos = atomIndices.get(atom.atomZ)!;
				writeSync(fd, `${name.padEnd(4)} ${pos.toString().padEnd(4)} ` +
							  `${format(fc[idx])} ${format(fc[idx+1])} ` +
							  `${format(fc[idx+2])}   11.00000   0\n`);
				idx += 3;
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
