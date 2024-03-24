/**
 * Reader for LAMMPS trajectory formatted files
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getStructureAppearanceFromZ} from "../modules/ReaderWriterHelpers";
import type {ReaderImplementation} from "../types";
import type {Structure, Atom} from "../../types";
import {getAtomicNumber} from "../modules/AtomData";

export class ReaderLAMMPStrj implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param atomsTypes - Optional atoms types to be used (normally they are not in the file)
	 * @returns - The set of structure read
	 */
	async readStructure(filename: string, atomsTypes?: string[]): Promise<Structure[]> {

		const structures: Structure[] = [];
		let currentStructure: Structure;

		let numberAtoms = 0;
		let lineType = "item";
		let atomIdx = 0;
		const correspond: number[] = [];
		let origin = 0;
		let atomZ = 0;
		let hasErrors = false;

		const reader = rd.createInterface(fs.createReadStream(filename));
		for await (const lineRaw of reader) {

			const line = lineRaw.trim();
			if(line === "" || line.startsWith("#")) continue;
			const fields = line.split(/ +/);

			switch(lineType) {
				case "item":
					if(fields[0] !== "ITEM:") {
						hasErrors = true;
						break;
					}
					switch(fields[1]) {
					case "TIMESTEP":
						currentStructure = {
							crystal: {
								basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
								origin: [0, 0, 0],
								spaceGroup: ""
							},
							atoms: [],
							bonds: [],
							look: {},
							volume: []
						};
						structures.push(currentStructure);
						lineType = "step";
						break;
					case "NUMBER":
						lineType = "natoms";
						break;
					case "BOX":
						lineType = "box1";
						break;
					case "ATOMS":
						lineType = "atom";
						break;
					}
					break;
				case "step":
					lineType = "item";
					break;
				case "natoms":
					numberAtoms = Number.parseInt(fields[0]);
					currentStructure!.atoms = Array(numberAtoms) as Atom[];
					atomIdx = 0;
					lineType = "item";
					break;
				case "box1":
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[0] = origin;
					currentStructure!.crystal.basis[0] = Number.parseFloat(fields[1]) - origin;
					lineType = "box2";
					break;
				case "box2":
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[1] = origin;
					currentStructure!.crystal.basis[4] = Number.parseFloat(fields[1]) - origin;
					lineType = "box3";
					break;
				case "box3":
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[2] = origin;
					currentStructure!.crystal.basis[8] = Number.parseFloat(fields[1]) - origin;
					lineType = "item";
					break;
				case "atom":
					atomZ = Number.parseInt(fields[1]);
					currentStructure!.atoms[atomIdx] = {
						label: fields[0],
						atomZ,
						position: [
							Number.parseFloat(fields[2]),
							Number.parseFloat(fields[3]),
							Number.parseFloat(fields[4]),
						]
					};

					correspond[atomZ] = 1;
					--numberAtoms;
					++atomIdx;
					if(numberAtoms === 0) lineType = "item";
					break;
			}
		}

		if(hasErrors) return [];

		// Assign the atoms types
		if(atomsTypes && atomsTypes.length > 0) {

			for(let idx=1, idxt=0; idx < correspond.length; ++idx) {
				if(correspond[idx]) {
					correspond[idx] = getAtomicNumber(atomsTypes[idxt++]);
					if(idxt >= atomsTypes.length) idxt = 0;
				}
			}

			for(const structure of structures) {
				for(const atom of structure.atoms) {
					atom.atomZ = correspond[atom.atomZ];
				}
				structure.look = getStructureAppearanceFromZ(correspond);
			}
		}
		else {
			for(let idx=1; idx <= correspond.length; ++idx) {
				if(correspond[idx]) correspond[idx] = idx+8;
			}

			for(const structure of structures) {
				structure.look = getStructureAppearanceFromZ(correspond);
			}
		}

		return structures;
	}
}
