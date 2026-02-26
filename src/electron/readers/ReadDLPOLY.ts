/**
 * Reader for DL_POLY HISTORY files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-11
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
import type {Structure, Atom, ReaderImplementation} from "@/types";
import {EmptyStructure} from "../modules/EmptyStructure";
import {getAtomicNumberByMass} from "../modules/AtomData";

/**
 * Line read type
 * @notExported
 */
const LineType = {
    header:  0,
    cell1:   1,
    cell2:   2,
    cell3:   3,
	step:    4,

    atom1:   5,
    atom2:   6,
    atom3:   7,
    atom4:   8,
} as const;

/**
 * Line read type
 * @notExported
 */
type Step = (typeof LineType)[keyof typeof LineType];

export class ReaderDLPOLY implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		let currentStructure: Structure | undefined;
		const structures: Structure[] = [];
		let currentAtom: Atom | undefined;
		let lineType: Step = LineType.header;
		let natoms = 0;
		let step = 1;
		let keytrj = 0;
		let fields: string[];

		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of reader) {

			fields = line.trim().split(/\s+/);

			switch(lineType) {

				case LineType.header:
				case LineType.step:
					if(line.startsWith("timestep ")) {

						if(fields.length < 4) throw Error(`Malformed timestep header at step ${step}`);
						currentStructure = new EmptyStructure();
						currentStructure.extra.step = step++;
						natoms = Number.parseInt(fields[2], 10);
						keytrj = Number.parseInt(fields[3], 10);
						lineType = LineType.cell1;
					}
					break;

				case LineType.cell1:
					currentStructure!.crystal.basis[0] = Number.parseFloat(fields[0]);
					currentStructure!.crystal.basis[1] = Number.parseFloat(fields[1]);
					currentStructure!.crystal.basis[2] = Number.parseFloat(fields[2]);
					lineType = LineType.cell2;
					break;

				case LineType.cell2:
					currentStructure!.crystal.basis[3] = Number.parseFloat(fields[0]);
					currentStructure!.crystal.basis[4] = Number.parseFloat(fields[1]);
					currentStructure!.crystal.basis[5] = Number.parseFloat(fields[2]);
					lineType = LineType.cell3;
					break;

				case LineType.cell3:
					currentStructure!.crystal.basis[6] = Number.parseFloat(fields[0]);
					currentStructure!.crystal.basis[7] = Number.parseFloat(fields[1]);
					currentStructure!.crystal.basis[8] = Number.parseFloat(fields[2]);
					structures.push(currentStructure!);
					lineType = LineType.atom1;
					break;

				case LineType.atom1:
					currentAtom = {
						atomZ: getAtomicNumberByMass(Number.parseFloat(fields[2])),
						label: fields[0],
						chain: "",
						position: [0, 0, 0]
					};
					lineType = LineType.atom2;
					break;

				case LineType.atom2:
					currentAtom!.position[0] = Number.parseFloat(fields[0]);
					currentAtom!.position[1] = Number.parseFloat(fields[1]);
					currentAtom!.position[2] = Number.parseFloat(fields[2]);
					currentStructure!.atoms.push(currentAtom!);

					if(keytrj > 0) {
						lineType = LineType.atom3;
					}
					else if(--natoms === 0) {
						lineType = LineType.step;
					}
					else {
						lineType = LineType.atom1;
					}
					break;

				case LineType.atom3:
					if(keytrj > 1) {
						lineType = LineType.atom4;
					}
					else if(--natoms === 0) {
						lineType = LineType.step;
					}
					else {
						lineType = LineType.atom1;
					}
					break;

				case LineType.atom4:
					lineType = --natoms === 0 ? LineType.step : LineType.atom1;
					break;
			}
		}

		return structures;
	}
}
