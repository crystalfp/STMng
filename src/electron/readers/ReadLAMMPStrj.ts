/**
 * Reader for LAMMPS trajectory formatted files
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getStructureAppearanceFromZ} from "../modules/ReaderWriterHelpers";
import type {ReaderImplementation, ReaderOptions} from "../types";
import type {Structure, Atom} from "../../types";
import {getAtomicNumber} from "../modules/AtomData";

/** Line read type */
const enum LineType {
    item,
    step,
    natoms,
    box1,
    box2,
    box3,
    atom,
}

export class ReaderLAMMPStrj implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param atomsTypes - Optional atoms types to be used (normally they are not in the file)
	 * @returns The set of structure read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structures: Structure[] = [];
		let currentStructure: Structure;

		let numberAtoms = 0;
		let lineType: LineType = LineType.item;
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
				case LineType.item:
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
						lineType = LineType.step;
						break;
					case "NUMBER":
						lineType = LineType.natoms;
						break;
					case "BOX":
						lineType = LineType.box1;
						break;
					case "ATOMS":
						lineType = LineType.atom;
						break;
					}
					break;
				case LineType.step:
					lineType = LineType.item;
					break;
				case LineType.natoms:
					numberAtoms = Number.parseInt(fields[0]);
					currentStructure!.atoms = Array(numberAtoms) as Atom[];
					atomIdx = 0;
					lineType = LineType.item;
					break;
				case LineType.box1:
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[0] = origin;
					currentStructure!.crystal.basis[0] = Number.parseFloat(fields[1]) - origin;
					lineType = LineType.box2;
					break;
				case LineType.box2:
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[1] = origin;
					currentStructure!.crystal.basis[4] = Number.parseFloat(fields[1]) - origin;
					lineType = LineType.box3;
					break;
				case LineType.box3:
					origin = Number.parseFloat(fields[0]);
					currentStructure!.crystal.origin[2] = origin;
					currentStructure!.crystal.basis[8] = Number.parseFloat(fields[1]) - origin;
					lineType = LineType.item;
					break;
				case LineType.atom:
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
					if(numberAtoms === 0) lineType = LineType.item;
					break;
			}
		}

		if(hasErrors) return [];

		// Assign the atoms types
		if(options?.atomsTypes && options.atomsTypes.length > 0) {

			for(let idx=1, idxt=0; idx < correspond.length; ++idx) {
				if(correspond[idx]) {
					correspond[idx] = getAtomicNumber(options.atomsTypes[idxt++]);
					if(idxt >= options.atomsTypes.length) idxt = 0;
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
				if(correspond[idx]) correspond[idx] = idx;
			}

			for(const structure of structures) {
				structure.look = getStructureAppearanceFromZ(correspond);
			}
		}

		return structures;
	}
}
