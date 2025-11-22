/**
 * Reader for XYZ formatted files
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
import type {Structure, Atom, ReaderImplementation} from "@/types";

export class ReaderXYZ implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 * @throws Error.
	 * "Wrong number of fields"
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const structures: Structure[] = [];
		let commentLine = false;
		let numberAtoms = 0;
		let step = -1;
		let atoms: Atom[];
		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const lineRaw of reader) {

			if(numberAtoms === 0) {
				numberAtoms = Number.parseInt(lineRaw, 10);
				if(Number.isNaN(numberAtoms) || numberAtoms <= 0) break;
				commentLine = true;
				++step;
				structures.push(new EmptyStructure());
				atoms = structures[step].atoms;
				structures[step].extra.step = step+1;
			}
			else if(commentLine) {
				commentLine = false;
			}
			else {
				const line = lineRaw.trim();
				if(line === "") throw Error("Invalid empty line found");
				const fields = line.split(/\s+/);
				if(fields.length < 4) throw Error(`Insufficient number of fields in "${line}"`);
				const position: [number, number, number] = [
					Number.parseFloat(fields[1]),
					Number.parseFloat(fields[2]),
					Number.parseFloat(fields[3]),
				];
				const atomZ = getAtomicNumber(fields[0]);
				if(atomZ === 0) throw Error(`Unknown atom type in "${line}"`);
				atoms!.push({position, label: fields[0], chain: "", atomZ});

				--numberAtoms;
			}
		}

		return structures;
	}
}
