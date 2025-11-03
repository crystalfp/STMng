/**
 * Reader for LAMMPS trajectory formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom, BasisType,
			 ReaderImplementation, ReaderOptions} from "@/types";

/**
 * Line read type
 * @notExported
 */
const LineType = {
    item:   0,
    step:   1,
    natoms: 2,
    box1:   3,
    box2:   4,
    box3:   5,
    atom:   6,
} as const;

/**
 * Line read type
 * @notExported
 */
type Step = (typeof LineType)[keyof typeof LineType];

/**
 * Types of unit cells
 * @notExported
 */
const BoxType = {
    unknown: 0,
    restrictedTriclinic:   1,
    rectangular:   2,
} as const;

/**
 * Type of unit cell kind variables
 * @notExported
 */
type Box = (typeof BoxType)[keyof typeof BoxType];

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
		let lineType: Step = LineType.item;
		let atomIdx = 0;
		const correspond: number[] = [];
		let atomZ = 0;
		let hasErrors = false;
		let boxType: Box = BoxType.unknown;
		const boxValues: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];

		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const lineRaw of reader) {

			const line = lineRaw.trim();
			if(line === "" || line.startsWith("#")) continue;
			const fields = line.split(/\s+/);

			switch(lineType) {
				case LineType.item:
					if(fields[0] !== "ITEM:") {
						hasErrors = true;
						break;
					}
					switch(fields[1]) {
					case "TIMESTEP":
						currentStructure = new EmptyStructure();
						structures.push(currentStructure);
						currentStructure.extra.step = structures.length;
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
					numberAtoms = Number.parseInt(fields[0], 10);
					currentStructure!.atoms = Array<Atom>(numberAtoms);
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
					atomZ = Number.parseInt(fields[1], 10);
					currentStructure!.atoms[atomIdx] = {
						atomZ,
						label: fields[0],
						chain: "",
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
		if(options?.atomsTypes?.length) {

			let maxAtomZ = 0;
			for(let idx=1, idxt=0; idx < correspond.length; ++idx) {
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
				return a.label > b.label ? 1 : -1;
			});
		}
		return structures;
	}
}
