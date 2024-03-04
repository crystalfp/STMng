
import type {Structure, MainResponse} from "../../types";
import type {WriterImplementation} from "../types";
import fs from "node:fs";
export class WriterXYZ implements WriterImplementation {

	writeStructure(filename: string, structures: Structure[]): MainResponse {

		try {
			const fd = fs.openSync(filename, "w");
			for(const structure of structures) {

				fs.writeSync(fd, `  ${structure.atoms.length}\n\n`);

				const {look, atoms} = structure;
				for(const atom of atoms) {
					const symbol = look[atom.atomZ].symbol.padEnd(2, " ");
					const x = atom.position[0].toFixed(6).padStart(10, " ");
					const y = atom.position[1].toFixed(6).padStart(10, " ");
					const z = atom.position[2].toFixed(6).padStart(10, " ");
					fs.writeSync(fd, `${symbol} ${x} ${y} ${z}\n`);
				}
			}
			fs.closeSync(fd);

			return {payload: "Success!"};
		}
		catch(error: unknown) {
			return {payload: "Error", error: (error as Error).message};
		}
	}
}
