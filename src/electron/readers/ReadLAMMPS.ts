/**
 * Reader for LAMMPS formatted files
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
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom,
			 ReaderImplementation, ReaderOptions} from "@/types";

export class ReaderLAMMPS implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structure: Structure = new EmptyStructure();

		let numberAtoms = 0;
		let lineType = "";
		let atomIdx = 0;
		let correspond: number[] = [];
		let ntypes = 0;

		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const lineRaw of reader) {

			const line = lineRaw.trim();
			if(line === "" || line.startsWith("#")) continue;

			const fields = line.split(/\s+/);

			if(lineType === "Atoms") {

				const nf = fields.length; // To check if line has atom charge before coordinates
				const atomZ = Number.parseInt(fields[1], 10);
				structure.atoms[atomIdx] = {
					atomZ,
					label: fields[0],
					chain: "",
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
				numberAtoms = Number.parseInt(fields[0], 10);
				structure.atoms = Array<Atom>(numberAtoms);
				atomIdx = 0;
			}
			else if(fields[1] === "atom" && fields[2] === "types") {
				ntypes = Number.parseInt(fields[0], 10);
				correspond = Array<number>(ntypes+1).fill(0);
			}
			else if(fields[0] === "Atoms") lineType = "Atoms";
			else {
				switch(fields[2]) {
					case "xlo":
						structure.crystal.origin[0] = Number.parseFloat(fields[0]);
						structure.crystal.basis[0] = Number.parseFloat(fields[1]) - structure.crystal.origin[0];
						break;
					case "ylo":
						structure.crystal.origin[1] = Number.parseFloat(fields[0]);
						structure.crystal.basis[4] = Number.parseFloat(fields[1]) - structure.crystal.origin[1];
						break;
					case "zlo":
						structure.crystal.origin[2] = Number.parseFloat(fields[0]);
						structure.crystal.basis[8] = Number.parseFloat(fields[1]) - structure.crystal.origin[2];
						break;
				}
			}
		}

		// Assign the atoms types
		if(options?.atomsTypes?.length) {

			let maxAtomZ = 0;
			for(let idx=1, idxt=0; idx <= ntypes; ++idx) {
				if(correspond[idx]) {

					if(idxt < options.atomsTypes.length) {
						correspond[idx] = getAtomicNumber(options.atomsTypes[idxt++]);
						if(correspond[idx] > maxAtomZ) maxAtomZ = correspond[idx];
					}
					else {
						correspond[idx] = ++maxAtomZ;
					}
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
