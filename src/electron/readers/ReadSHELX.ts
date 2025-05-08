/**
 * Reader for Shel-X formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {extractBasis, fractionalToCartesianCoordinates} from "../modules/Helpers";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom, ReaderImplementation} from "@/types";

export class ReaderSHELX implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const structures: Structure[] = [new EmptyStructure()];
		let spaceGroup = "";
		let latticeType = 0;
		let ignoreNext = false;

		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of reader) {

			const lineUC = line.toUpperCase();
			if(lineUC.startsWith("END")) break;

			// Ignore continuation lines
			if(ignoreNext) {
				ignoreNext = false;
				continue;
			}

			// Ignore keywords and lines starting with blank
			if(/^[^A-Z]/.test(lineUC) ||
				lineUC.startsWith("TITL") ||
				lineUC.startsWith("ZERR") ||
				lineUC.startsWith("SIZE") ||
				lineUC.startsWith("UNIT") ||
				lineUC.startsWith("REM")  ||
				lineUC.startsWith("HKLF") ||
				lineUC.startsWith("OMIT") ||
				lineUC.startsWith("FVAR") ||
				lineUC.startsWith("SFAC")) continue;

			// Get the lines to be used
			if(lineUC.startsWith("SYMM")) {
				// eslint-disable-next-line sonarjs/slow-regex
				const sg = lineUC.replace(/\s+\(.+$/, "").replace(/^SYMM\s+/, "");
				if(spaceGroup) spaceGroup += "\n" + sg;
				else spaceGroup = sg;
			}
			else if(lineUC.startsWith("LATT")) {
				latticeType = Number.parseInt(lineUC.slice(5), 10);
			}
			else if(lineUC.startsWith("CELL")) {
				const fields = lineUC.split(/\s+/);
				if(fields.length < 8) continue;
				const a = Number.parseFloat(fields[2]);
				const b = Number.parseFloat(fields[3]);
				const c = Number.parseFloat(fields[4]);
				const alpha = Number.parseFloat(fields[5]);
				const beta  = Number.parseFloat(fields[6]);
				const gamma = Number.parseFloat(fields[7]);

				structures[0].crystal.basis = extractBasis(a, b, c, alpha, beta, gamma);
			}
			else {
				// Ordinary atom line
				const fields = line.split(/\s+/);
				if(fields.length < 5) continue;

				// Extract the element type
				const atomZ = getAtomicNumber(fields[0].replace(/\d+/, ""));
				if(atomZ === 0) continue;

				// Fractional coordinates converted to cartesian coordinates
				const fx = Number.parseFloat(fields[2]);
				const fy = Number.parseFloat(fields[3]);
				const fz = Number.parseFloat(fields[4]);
				const position = fractionalToCartesianCoordinates(structures[0].crystal.basis, fx, fy, fz);

				// Add the atom
				const atom: Atom = {atomZ, label: fields[0], chain: "", position};
				structures[0].atoms.push(atom);

				// If the line has a continuation line, mark this to be skipped
				if(lineUC.includes("=")) ignoreNext = true;
			}
		}

		// All lines read. Set the structure space group
		// Cover the case of LATT without SYMM cards
		if(latticeType !== 0) {

			spaceGroup = spaceGroup === "" ? `(${latticeType})x,y,z` : `(${latticeType})${spaceGroup}`;
		}
		structures[0].crystal.spaceGroup = spaceGroup || "P 1";

		return structures;
	}
}
