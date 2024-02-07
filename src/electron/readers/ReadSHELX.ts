/**
 * Reader for ShelX formatted files
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getAtomicNumber, getCovalentRadii, getMaxBonds} from "../modules/AtomData";
import {computeBonds} from "../../services/ComputeBonds";
import type {ReaderImplementation} from "../types";
import type {Crystal, Structure, Atom} from "../../types";
import {extractBasis, fractionalToCartesianCoordinates, getStructureAppearance} from "../modules/ReaderHelpers";

export class ReaderSHELX implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns - The set of structure read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const crystal: Crystal = {
			basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
			origin: [0, 0, 0],
			spaceGroup: ""
		};
		const structures: Structure[] = [{crystal, atoms: [], bonds: [], look: {}}];
		let spaceGroup = "";
		let latticeType = 0;
		let ignoreNext = false;

		const reader = rd.createInterface(fs.createReadStream(filename));
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

			if(lineUC.startsWith("SYMM")) {
				const sg = lineUC.replace(/\s+\(.+$/, "").replace(/^SYMM\s+/, "");
				if(spaceGroup) spaceGroup += `\n${sg}`;
				else spaceGroup = sg;
			}
			else if(lineUC.startsWith("LATT")) {
				latticeType = Number.parseInt(lineUC.slice(5));
			}
			else if(lineUC.startsWith("CELL")) {
				const fields = lineUC.split(/ +/);
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
				const fields = line.split(/ +/);

				// Extract the element type
				const atomZ = getAtomicNumber(fields[0].replace(/\d+/, ""));
				if(atomZ === 0) continue;

				// Fractional coordinates converted to cartesian coordinates
				const fx = Number.parseFloat(fields[2]);
				const fy = Number.parseFloat(fields[3]);
				const fz = Number.parseFloat(fields[4]);
				const position = fractionalToCartesianCoordinates(structures[0].crystal.basis, fx, fy, fz);

				// Add the atom
				const atom: Atom = {atomZ, label: fields[0], position};
				structures[0].atoms.push(atom);

				// If the line has a continuation line, mark this to be skipped
				if(lineUC.includes("=")) ignoreNext = true;
			}
		}

		// Set the structure space group
		// Cover the case of LATT without SYMM cards
		if(latticeType !== 0) {

			spaceGroup = spaceGroup === "" ? `(${latticeType})x,y,z` : `(${latticeType})${spaceGroup}`;
		}
		structures[0].crystal.spaceGroup = spaceGroup || "P 1";

		// Build the rest of the structure
		structures[0].look  = getStructureAppearance(structures[0].atoms);
		structures[0].bonds = computeBonds(structures[0].atoms,
									getCovalentRadii(structures[0].atoms), getMaxBonds(structures[0].atoms));

		return structures;
	}
}
