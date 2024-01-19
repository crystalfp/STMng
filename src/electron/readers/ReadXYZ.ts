import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getAtomicNumber, getCovalentRadii} from "../modules/AtomData";
import {getStructureAppearance} from "../modules/ComputeLook";
import {computeBonds} from "../../services/ComputeBonds";
import type {ReaderImplementation} from "../types";
import type {Crystal, Structure} from "../../types";

export class ReaderXYZ implements ReaderImplementation {

	async readStructure(filename: string): Promise<Structure[]> {

		const structures: Structure[] = [];
		let commentLine = false;
		let numberAtoms = 0;
		let step = -1;
		let atoms;
		const reader = rd.createInterface(fs.createReadStream(filename));
		for await (const line of reader) {

			if(numberAtoms === 0) {
				numberAtoms = Number.parseInt(line, 10);
				commentLine = true;
				++step;
				const crystal: Crystal = {
					basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
					origin: [0, 0, 0],
					spaceGroup: ""
				};
				structures.push({crystal, atoms: [], bonds: [], look: {}});
				atoms = structures[step].atoms;
			}
			else if(commentLine) {
				commentLine = false;
			}
			else {
				const fields = line.trim().split(/ +/);
				const position: [number, number, number] = [
					Number.parseFloat(fields[1]),
					Number.parseFloat(fields[2]),
					Number.parseFloat(fields[3]),
				];
				atoms!.push({position, label: fields[0], atomZ: getAtomicNumber(fields[0])});

				--numberAtoms;
			}
		}

		// Build the structure
		for(const structure of structures) {
			structure.look = getStructureAppearance(structure.atoms);
			structure.bonds = computeBonds(structure.atoms, getCovalentRadii(structure.atoms));
		}

		return structures;
	}
}
