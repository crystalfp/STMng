/**
 * Reader for LAMMPS formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import type {Crystal, Structure, Atom,
			 ReaderImplementation, ReaderOptions} from "../../types";
import {getAtomicNumber} from "../modules/AtomData";

export class ReaderLAMMPS implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const crystal: Crystal = {
			basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
			origin: [0, 0, 0],
			spaceGroup: ""
		};

		const structure: Structure = 	{
			crystal,
			atoms: [],
			bonds: [],
			volume: []
		};
		let numberAtoms = 0;
		let lineType = "";
		let atomIdx = 0;
		let correspond: number[] = [];
		let ntypes = 0;

		const reader = rd.createInterface(fs.createReadStream(filename));
		for await (const lineRaw of reader) {

			const line = lineRaw.trim();
			if(line === "" || line.startsWith("#")) continue;

			const fields = line.split(/ +/);

			if(lineType === "Atoms") {

				const nf = fields.length; // To check if line has atom charge before coordinates
				const atomZ = Number.parseInt(fields[1]);
				structure.atoms[atomIdx] = {
					label: fields[0],
					atomZ,
					position: (nf === 5 || nf === 8) ?
					[
						Number.parseFloat(fields[2]),
						Number.parseFloat(fields[3]),
						Number.parseFloat(fields[4]),
					] :
					[
						Number.parseFloat(fields[3]),
						Number.parseFloat(fields[4]),
						Number.parseFloat(fields[5]),
					]
				};

				correspond[atomZ] = 1;
				--numberAtoms;
				++atomIdx;
				if(numberAtoms === 0) break;
			}
			else if(fields[1] === "atoms") {
				numberAtoms = Number.parseInt(fields[0]);
				structure.atoms = Array(numberAtoms) as Atom[];
				atomIdx = 0;
			}
			else if(fields[1] === "atom" && fields[2] === "types") {
				ntypes = Number.parseInt(fields[0]);
				correspond = Array(ntypes+1).fill(0) as number[];
			}
			else if(fields[0] === "Atoms") lineType = "Atoms";
			else {
				switch(fields[2]) {
					case "xlo":
						crystal.origin[0] = Number.parseFloat(fields[0]);
						crystal.basis[0] = Number.parseFloat(fields[1]) - crystal.origin[0];
						break;
					case "ylo":
						crystal.origin[1] = Number.parseFloat(fields[0]);
						crystal.basis[4] = Number.parseFloat(fields[1]) - crystal.origin[1];
						break;
					case "zlo":
						crystal.origin[2] = Number.parseFloat(fields[0]);
						crystal.basis[8] = Number.parseFloat(fields[1]) - crystal.origin[2];
						break;
				}
			}
		}

		// Assign the atoms types
		if(options?.atomsTypes && options.atomsTypes.length > 0) {

			for(let idx=1, idxt=0; idx <= ntypes; ++idx) {
				if(correspond[idx]) {
					correspond[idx] = getAtomicNumber(options.atomsTypes[idxt++]);
					if(idxt >= options.atomsTypes.length) idxt = 0;
				}
			}
		}
		else {
			for(let idx=1; idx <= ntypes; ++idx) {
				if(correspond[idx]) correspond[idx] = idx;
			}
		}
		for(const atom of structure.atoms) {
			atom.atomZ = correspond[atom.atomZ];
		}

		return [structure];
	}
}
