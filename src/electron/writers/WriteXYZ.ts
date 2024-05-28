/**
 * Writer for XYZ formatted files
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import {format} from "../modules/ReaderWriterHelpers";
import type {Structure, MainResponse} from "../../types";
import type {WriterImplementation} from "../types";
import {getAtomicSymbol} from "../modules/AtomData";

export class WriterXYZ implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): MainResponse {

		try {
			const fd = fs.openSync(filename, "w");
			for(const structure of structures) {

				const {atoms} = structure;

				fs.writeSync(fd, `  ${atoms.length}\n\n`);

				for(const atom of atoms) {
					const symbol = getAtomicSymbol(atom.atomZ).padEnd(2, " ");
					const x = format(atom.position[0]);
					const y = format(atom.position[1]);
					const z = format(atom.position[2]);
					fs.writeSync(fd, `${symbol} ${x} ${y} ${z}\n`);
				}
			}
			fs.closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {payload: "Error", error: (error as Error).message};
		}
	}
}
