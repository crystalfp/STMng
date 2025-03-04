/**
 * Reader for XYZ formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, ReaderImplementation} from "@/types";

export class ReaderXYZ implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const structures: Structure[] = [];
		let commentLine = false;
		let numberAtoms = 0;
		let step = -1;
		let atoms;
		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of reader) {

			if(numberAtoms === 0) {
				numberAtoms = Number.parseInt(line, 10);
				commentLine = true;
				++step;
				structures.push(new EmptyStructure());
				atoms = structures[step].atoms;
			}
			else if(commentLine) {
				commentLine = false;
			}
			else {
				const fields = line.trim().split(/\s+/);
				if(fields.length !== 4) throw Error(`Wrong number of fields in "${line}"`);
				const position: [number, number, number] = [
					Number.parseFloat(fields[1]),
					Number.parseFloat(fields[2]),
					Number.parseFloat(fields[3]),
				];
				atoms!.push({position, label: fields[0], chain: "", atomZ: getAtomicNumber(fields[0])});

				--numberAtoms;
			}
		}

		return structures;
	}
}
