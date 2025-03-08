/**
 * Reader for PDB formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-23
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {extractBasis, invertBasis} from "../modules/Helpers";
import {getAtomicNumber} from "../modules/AtomData";
import type {Structure, ReaderImplementation, BasisType,
			 Atom, Bond, ReaderOptions} from "@/types";

/**
 * Extract a floating point number from a fixed length field
 *
 * @param line - Record read
 * @param start - Start position
 * @param length - Length of the field
 * @returns The float number contained in the field
 */
const fixedWidthFloat = (line: string, start: number, length: number): number =>
           Number.parseFloat(line.slice(start, start+length).trim());

/**
 * Extract an integer from a fixed length field
 *
 * @param line - Record read
 * @param start - Start position
 * @param length - Length of the field
 * @returns The integer number contained in the field
 */
const fixedWidthInt = (line: string, start: number, length: number): number =>
           Number.parseInt(line.slice(start, start+length).trim(), 10);

/**
 * Extract a string from a fixed length field
 *
 * @param line - Record read
 * @param start - Start position
 * @param length - Length of the field
 * @returns The trimmed string contained in the field
 */
const fixedWidthStringSpaceTrimmed = (line: string, start: number, length: number): string =>
           line.slice(start, start+length).trim();

/**
 * Extract an integer from a fixed length field with default
 *
 * @param line - Record read
 * @param start - Start position
 * @param length - Length of the field
 * @returns The integer number contained in the field or -1 if the field is empty
 */
const fixedWidthIntNotEmpty = (line: string, start: number, length: number): number => {
	const field = line.slice(start, start+length).trim();
	if(field === "") return -1;
	return Number.parseInt(field, 10);
};

/** Map of used record types */
const recordTypes = new Map<string, number>([
	["MODEL ", 0],
	["HEADER", 0],
	["END   ", 0],
	["ENDMDL", 0],
	["CRYST1", 1],
	["ATOM  ", 2],
	["HETATM", 2],
	["CONECT", 3],
	["SCALE1", 4],
	["SCALE2", 4],
	["SCALE3", 4],
]);

export class ReaderPDB implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structures: Structure[] = [];
		let currentStructure = -1;
		let hasScale1 = false;
		let hasScale2 = false;
		let hasScaleAll = false;
		let hasCryst1 = false;
		const origin = [0, 0, 0];
		const basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		const snMap = new Map<number, number>();
		let atomIdx = 0;
		const readHydrogen = options?.readHydrogen ?? false;
		let tryStartStep = true;

		const reader = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const line of reader) {

			// Extract record type
			const recordType = recordTypes.get(line.slice(0, 6));
			if(recordType === undefined) continue;

			// "MODEL", "HEADER", "END", "ENDMDL"
			if(recordType === 0) {
				tryStartStep = true;
				continue;
			}

			// Start a new structure
			if(tryStartStep) {
				tryStartStep = false;
				hasCryst1 = false;
				const structure: Structure = {

					crystal: {
						basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
						origin: [0, 0, 0],
						spaceGroup: ""
					},
					atoms: [],
					bonds: [],
					volume: [],
					extra: {step: currentStructure+2},
				};
				structures.push(structure);
				++currentStructure;
			}

			switch(recordType) {

				case 1: {
					// "CRYST1"
					const a     = fixedWidthFloat(line, 6,  9);
					const b     = fixedWidthFloat(line, 15, 9);
					const c     = fixedWidthFloat(line, 24, 9);
					const alpha = fixedWidthFloat(line, 33, 7);
					const beta  = fixedWidthFloat(line, 40, 7);
					const gamma = fixedWidthFloat(line, 47, 7);

					const matrix = extractBasis(a, b, c, alpha, beta, gamma);
					const {basis} = structures[currentStructure].crystal;
					for(let i=0; i < 9; ++i) basis[i] = matrix[i];
					structures[currentStructure].crystal.spaceGroup = line.slice(55, 65).trim();
					hasCryst1 = true;
					break;
				}

				case 2: {
					// "ATOM", "HETATM"
					let atomSymbol = fixedWidthStringSpaceTrimmed(line, 76, 2);
					let atomZ = getAtomicNumber(atomSymbol);

					// If there is no valid symbol, try to guess it from the atom label
					if(atomZ === 0) {
						atomSymbol = fixedWidthStringSpaceTrimmed(line, 12, 2);
						if(["CA", "CD", "CE", "CF"].includes(atomSymbol)) atomSymbol = "C";
						else if(["HE", "HF", "HG"].includes(atomSymbol)) atomSymbol = "H";
						atomZ = getAtomicNumber(atomSymbol);
						if(atomZ === 0) {
							atomZ = getAtomicNumber(atomSymbol[0]);
							if(atomZ === 0) continue;
						}
					}

					// Exclude hydrogen atoms
					if(readHydrogen || atomZ !== 1) {

						const sn = fixedWidthInt(line, 6, 5);
						const label = fixedWidthStringSpaceTrimmed(line, 12, 4).split(" ")[0];
						const x = fixedWidthFloat(line, 30, 8);
						const y = fixedWidthFloat(line, 38, 8);
						const z = fixedWidthFloat(line, 46, 8);

						const {atoms} = structures[currentStructure];

						const atom: Atom = {
							atomZ,
							label,
							chain: fixedWidthStringSpaceTrimmed(line, 21, 1),
							position: [x, y, z]
						};
						atoms.push(atom);

						// const residueName = fixedWidthStringSpaceTrimmed(line, 17, 3);
						// if(!residues!.chains.includes(chainName)) residues!.chains.push(chainName);
						// residues!.atoms.push({residue: residueName, chain: chainName});

						snMap.set(sn, atomIdx);
						++atomIdx;
					}
					break;
				}

				case 3: {
					// "CONECT"
					let from: number;
					let to1: number;
					let to2: number;
					let to3: number;
					let to4: number;
					let hb1: number;
					let hb2: number;
					let ne0: number;
					let ne1: number;
					let ne2: number;
					let ne3: number;
					let ne4: number;
					let ne5: number;
					let ne6: number;
					const len = line.length;

					/* eslint-disable unicorn/prefer-ternary */
					if(len > 11) {
						ne0 = from = fixedWidthIntNotEmpty(line, 6, 5);
					}
					else ne0 = -1;
					if(len > 16) {
						ne1 = to1 = fixedWidthIntNotEmpty(line, 11, 5);
					}
					else ne1 = -1;
					if(len > 21) {
						ne2 = to2 = fixedWidthIntNotEmpty(line, 16, 5);
					}
					else ne2 = -1;
					if(len > 26) {
						ne3 = to3 = fixedWidthIntNotEmpty(line, 21, 5);
					}
					else ne3 = -1;
					if(len > 31) {
						ne4 = to4 = fixedWidthIntNotEmpty(line, 26, 5);
					}
					else ne4 = -1;
					if(len > 36) {
						ne5 = hb1 = fixedWidthIntNotEmpty(line, 31, 5);
					}
					else ne5 = -1;
					if(len > 41) {
						ne6 = hb2 = fixedWidthIntNotEmpty(line, 36, 5);
					}
					else ne6 = -1;
					/* eslint-enable unicorn/prefer-ternary */

					if(ne0 >= 0 && snMap.has(from!)) {

						// Normalize the from value
						from = snMap.get(from!)!;

						// Add the bonds
						const {bonds} = structures[currentStructure];
						if(ne1 >= 0) {
							this.checkAndAddBond(from, to1!, snMap, bonds, 0);
						}
						if(ne2 >= 0) {
							this.checkAndAddBond(from, to2!, snMap, bonds, 0);
						}
						if(ne3 >= 0) {
							this.checkAndAddBond(from, to3!, snMap, bonds, 0);
						}
						if(ne4 >= 0) {
							this.checkAndAddBond(from, to4!, snMap, bonds, 0);
						}
						if(ne5 >= 0) {
							this.checkAndAddBond(from, hb1!, snMap, bonds, 1);
						}
						if(ne6 >= 0) {
							this.checkAndAddBond(from, hb2!, snMap, bonds, 1);
						}
					}
					break;
				}

				case 4: {
					// "SCALEx"
					let seq = line.slice(5, 6);
					const a = fixedWidthFloat(line, 10,  10);
					const b = fixedWidthFloat(line, 20,  10);
					const c = fixedWidthFloat(line, 30,  10);
					const d = fixedWidthFloat(line, 45,  10);

					// Try to cope with incorrectly numbered SCALEn entries (eg. 3 times SCALE1)
					switch(seq)	{
						case "1":
							if(hasScale1) {
								if(hasScale2) {
									seq = "3";
								}
								else {
									seq = "2";
									hasScale2 = true;
								}
							}
							else {
								hasScale1 = true;
							}
							break;
						case "2":
							if(hasScale2) {
								seq = "3";
							}
							else {
								hasScale2 = true;
							}
							break;
					}

					// Now fill the matrix and the origin values
					switch(seq) {
						case "1":
							origin[0] = d;
							basis[0] = a;
							basis[1] = b;
							basis[2] = c;
							break;
						case "2":
							origin[1] = d;
							basis[3] = a;
							basis[4] = b;
							basis[5] = c;
							break;
						case "3":
							origin[2] = d;
							basis[6] = a;
							basis[7] = b;
							basis[8] = c;
							hasScaleAll = true;
							break;
					}
				}

				if(hasScaleAll) {

					hasScaleAll = false;
					const r = invertBasis(basis);
void origin;
					// structures[currentStructure].crystal.origin = [
					// 	-(r[0]*origin[0]+r[1]*origin[1]+r[2]*origin[2]),
					// 	-(r[3]*origin[0]+r[4]*origin[1]+r[5]*origin[2]),
					// 	-(r[6]*origin[0]+r[7]*origin[1]+r[8]*origin[2])
					// ];
// console.log("BASIS", r);
// console.log("ORIGIN", structures[currentStructure].crystal.origin);
					if(!hasCryst1) {
						const bb = structures[currentStructure].crystal.basis;
						for(let i=0; i < 9; ++i) bb[i] = r[i];
					}
				}
				break;
			}
		}

// const frag = new Set<string>();
// for(const ra of structures[0].residues?.atoms ?? []) frag.add(ra.residue);
// console.log(frag);

		return structures;
	}

	/**
	 * Check if the given bond is valid and is not repeated
	 *
	 * @param from - Atom index for the from side of the bond
	 * @param to - PDB atom index for the end side of the bond
	 * @param snMap - Map from pdb to structure index
	 * @param bonds - Bonds list to be updated
	 * @param type - Type of the bond: 0: normal bond; 1: hydrogen bond
	 */
	private checkAndAddBond(from: number, to: number,
							snMap: Map<number, number>,
							bonds: Bond[], type: 0 | 1): void {

		if(snMap.has(to)) {

			to = snMap.get(to)!;

			const b: Bond = {
				from,
				to,
				type
			};

			bonds.push(b);
		}
	}
}
