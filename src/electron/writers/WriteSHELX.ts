/**
 * Writer for Shel-X formatted files
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import {cartesianToFractionalCoordinates,
		basisToLengthAngles, format} from "../modules/ReaderWriterHelpers";
import type {Structure, MainResponse} from "../../types";
import type {WriterImplementation} from "../types";

export class WriterSHELX implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): MainResponse {
		try {
			const fd = fs.openSync(filename, "w");

			// Access the structure
			const {crystal, atoms, look} = structures[0];
			const {basis, spaceGroup} = crystal;

			// Comment line
    		fs.writeSync(fd, "TITL Created by STMng\n");

			// Output the unit cell, if any
			if(basis.some((value) => value !== 0)) {

				const cell = basisToLengthAngles(basis);

				fs.writeSync(fd,
						`CELL 1.54180 ${cell[0].toFixed(4)} ${cell[1].toFixed(4)} ${cell[2].toFixed(4)}` +
						` ${cell[3].toFixed(4)} ${cell[4].toFixed(4)} ${cell[5].toFixed(4)}\n`);
			}

			// Space group
			if(spaceGroup !== "") {

				if(spaceGroup.startsWith("(")) {

					const pos = spaceGroup.indexOf(")");
					fs.writeSync(fd, `LATT ${spaceGroup.slice(1, pos)}\n`);
					const symms = spaceGroup.slice(pos+1).split("\n");
					for(const symm of symms) fs.writeSync(fd, `SYMM ${symm}\n`);
				}
				else if("PpCcIiFfAa".includes(spaceGroup.at(0)!)) {
	    			fs.writeSync(fd, `SYMM ${spaceGroup} (0)\n`);
				}
				else {
					const symms = spaceGroup.split("\n");
					for(const symm of symms) fs.writeSync(fd, `SYMM ${symm}\n`);
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
				line += ` ${look[item[0]].symbol}`;
			}
			line += "\n";
			fs.writeSync(fd, line);

			// The counts
			line = "UNIT";
			for(const item of atomCounts) {
				line += ` ${item[1]}`;
			}
			line += "\n";
			fs.writeSync(fd, line);

			// Output coordinates
			const fc = cartesianToFractionalCoordinates(structures[0]);

			idx = 0;
			for(const atom of atoms) {
				const name = look[atom.atomZ].symbol;
				const pos = atomIndices.get(atom.atomZ)!;
				fs.writeSync(fd, `${name.padEnd(4)} ${pos.toString().padEnd(4)} ` +
							 	 `${format(fc[3*idx])} ${format(fc[3*idx+1])} ` +
								 `${format(fc[3*idx+2])}   11.00000   0\n`);
				++idx;
			}

			fs.writeSync(fd, "END\n");
			fs.closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error: unknown) {
			return {payload: "Error", error: (error as Error).message};
		}
	}
}
