/**
 * Writer for XYZ formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {openSync, writeSync, closeSync} from "node:fs";
import {format, reducingToFractionalCoordinates} from "../modules/Helpers";
import type {Structure, WriterImplementation, CtrlParams} from "@/types";

export class WriterXYZ implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): CtrlParams {

		try {
			const fd = openSync(filename, "w");
			for(const structure of structures) {

				// Remove duplicates
				const reduced = reducingToFractionalCoordinates(structure);

				writeSync(fd, `  ${reduced.atoms.length}\n\n`);

				for(const atom of reduced.atoms) {
					const symbol = atom.symbol.padEnd(2, " ");
					const x = format(atom.cart[0]);
					const y = format(atom.cart[1]);
					const z = format(atom.cart[2]);
					writeSync(fd, `${symbol} ${x} ${y} ${z}\n`);
				}
			}
			closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error) {
			return {error: (error as Error).message};
		}
	}
}
