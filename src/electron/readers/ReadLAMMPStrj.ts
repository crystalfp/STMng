/**
 * Reader for LAMMPS trajectory formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import type {ReaderImplementation, ReaderOptions} from "../types";
import type {Structure, Atom, BasisType} from "../../types";
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

/** Types of unit cells */
const enum BoxType {
	unknown,
	restrictedTriclinic,
	rectangular
}

export class ReaderLAMMPStrj implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structure read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structures: Structure[] = [];
		let currentStructure: Structure;

		let numberAtoms = 0;
		let lineType: LineType = LineType.item;
		let atomIdx = 0;
		const correspond: number[] = [];
		let atomZ = 0;
		let hasErrors = false;
		let boxType: BoxType = BoxType.unknown;
		const boxValues: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];

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
						if(fields[3] === "xy") boxType = BoxType.restrictedTriclinic;
						else if(fields[3] === "xlo") boxType = BoxType.rectangular;
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
					boxValues[0] = Number.parseFloat(fields[0]);
					boxValues[1] = Number.parseFloat(fields[1]);
					if(fields.length > 2) boxValues[2] = Number.parseFloat(fields[2]);
					lineType = LineType.box2;
					break;
				case LineType.box2:
					boxValues[3] = Number.parseFloat(fields[0]);
					boxValues[4] = Number.parseFloat(fields[1]);
					if(fields.length > 2) boxValues[5] = Number.parseFloat(fields[2]);
					lineType = LineType.box3;
					break;
				case LineType.box3:
					boxValues[6] = Number.parseFloat(fields[0]);
					boxValues[7] = Number.parseFloat(fields[1]);
					if(fields.length > 2) boxValues[8] = Number.parseFloat(fields[2]);

 					if(boxType === BoxType.rectangular) {
						currentStructure!.crystal.origin[0] = boxValues[0];
						currentStructure!.crystal.origin[1] = boxValues[3];
						currentStructure!.crystal.origin[2] = boxValues[6];

						currentStructure!.crystal.basis[0]  = boxValues[1] - boxValues[0];
						currentStructure!.crystal.basis[4]  = boxValues[4] - boxValues[3];
						currentStructure!.crystal.basis[8]  = boxValues[7] - boxValues[6];
					}
 					else if(boxType === BoxType.restrictedTriclinic) {
						// The format is different from the documentation. This is the documentation:
						// currentStructure!.crystal.origin[0] = boxValues[0];
						// currentStructure!.crystal.origin[1] = boxValues[3];
						// currentStructure!.crystal.origin[2] = boxValues[6];

						// currentStructure!.crystal.basis[0]  = boxValues[1] - boxValues[0];
						// currentStructure!.crystal.basis[3]  = boxValues[2];
						// currentStructure!.crystal.basis[4]  = boxValues[4] - boxValues[3];
						// currentStructure!.crystal.basis[6]  = boxValues[5];
						// currentStructure!.crystal.basis[7]  = boxValues[8];
						// currentStructure!.crystal.basis[8]  = boxValues[7] - boxValues[6];

						currentStructure!.crystal.basis[0]  = boxValues[1];
						currentStructure!.crystal.basis[3]  = boxValues[2];
						currentStructure!.crystal.basis[4]  = boxValues[4];
						currentStructure!.crystal.basis[6]  = boxValues[5];
						currentStructure!.crystal.basis[7]  = boxValues[8];
						currentStructure!.crystal.basis[8]  = boxValues[7];
					}

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
			}
		}
		else {
			for(let idx=1; idx <= correspond.length; ++idx) {
				if(correspond[idx]) correspond[idx] = idx;
			}
		}

		for(const structure of structures) {
			structure.atoms.sort((a: Atom, b: Atom): number => {
				const delta = a.atomZ - b.atomZ;
				if(delta !== 0) return delta;
				if(a.label === b.label) return 0;
				if(a.label > b.label) return 1;
				return -1;
			});
		}
		return structures;
	}
}
