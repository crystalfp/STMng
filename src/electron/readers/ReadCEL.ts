/**
 * Read Powdercell's CEL-format file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-24
 */

/*
  Read/write Powdercell's CEL-format file

ftp://ftp.bam.de/Powder_Cell/structure_files/
http://ccp14.cryst.bbk.ac.uk/ccp/web-mirrors/powdcell/a_v/v_1/powder/details/powcell.htm

cell 8.23289 4.63556 3.01277 90 90 55.7328
natom 10
Al1 13 0.90956 0.25542 0.54403
Al2 13 0.65956 0.0361 0.04403
Al3 13 0.15956 0.47474 0.04403
Al4 13 0.40956 0.75542 0.54403
O1 8 0.84399 0.5655 0.04403
O2 8 0.47513 0.93437 0.04403
O3 8 0.65956 0.25789 0.54403
O4 8 0.97513 0.94534 0.04403
O5 8 0.15956 0.25295 0.54403
O6 8 0.34399 0.57647 0.04403
rgnr 1

*/
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {extractBasis, fractionalToCartesianCoordinates} from "../modules/Helpers";
import {EmptyStructure} from "../modules/EmptyStructure";
import {convertSpaceGroupNumber} from "../modules/NativeFunctions";
import {getAtomicNumber, getAtomicSymbol} from "../modules/AtomData";
import type {Structure, Atom, ReaderImplementation} from "@/types";

export class ReaderCEL implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @returns The set of structures read
	 */
	async readStructure(filename: string): Promise<Structure[]> {

		const structures: Structure[] = [new EmptyStructure()];
		let rdnatoms = -1;

		const reader = rd.createInterface(fs.createReadStream(filename));
		for await (const line of reader) {

			const lineNC = line.trim();
			if(lineNC === "") continue;
			const lineUC = lineNC.toUpperCase();
			if(lineUC.startsWith("REM")) continue;

			const fields = lineNC.split(/ +/);

			if(lineUC.startsWith("CELL")) {

				if(fields.length < 7) continue;
				const a = Number.parseFloat(fields[1]);
				const b = Number.parseFloat(fields[2]);
				const c = Number.parseFloat(fields[3]);
				const alpha = Number.parseFloat(fields[4]);
				const beta  = Number.parseFloat(fields[5]);
				const gamma = Number.parseFloat(fields[6]);

				structures[0].crystal.basis = extractBasis(a, b, c, alpha, beta, gamma);
			}

			else if(lineUC.startsWith("RGNR")) {

				const cnt = fields.length;

				if(cnt === 1) throw Error("Missing space group in RGNR");

				const nspaceGroup = Number.parseInt(fields[1]);
				if(nspaceGroup < 1 || nspaceGroup > 230) {
					throw Error(`Invalid space group number ${nspaceGroup}`);
				}

				let variation;
				if(cnt === 2) {
					variation = 0;
				}
				else {
					variation = Number.parseInt(fields[2]);
					if(variation > 0) --variation;
				}

				const computed = convertSpaceGroupNumber(nspaceGroup, variation);
				switch(computed.errorNumber) {
					case 0:
						structures[0].crystal.spaceGroup = computed.spaceGroup;
						break;
					case 1:
						console.log(`Space group var ${variation+1} invalid for sg ${nspaceGroup}`);
						structures[0].crystal.spaceGroup = computed.spaceGroup;
						break;
					default: throw Error(computed.spaceGroup);
				}
				break;
			}

			else if(lineUC.startsWith("NATOM")) {

				rdnatoms = Number.parseInt(fields[1], 10);
			}

			else if(!line.startsWith(" ")) {

				// Ordinary atom line
				if(fields.length >= 5) {

					// Extract the element type
					let atomZ = Number.parseInt(fields[1], 10);
					if(Number.isNaN(atomZ)) {
						const atomType = fields[1].replaceAll(/[^a-z]/gi, "");
						atomZ = getAtomicNumber(atomType);
					}
					if(atomZ === 0) {
						throw Error(`Invalid atom Z value: ${fields[1]}`);
					}

					// Fractional coordinates converted to cartesian coordinates
					const fx = Number.parseFloat(fields[2]);
					const fy = Number.parseFloat(fields[3]);
					const fz = Number.parseFloat(fields[4]);
					const position = fractionalToCartesianCoordinates(structures[0].crystal.basis,
																	  fx, fy, fz);

					// Add missing label
					const label = fields[0] === " " ? getAtomicSymbol(atomZ) : fields[0];

					// Add the atom
					const atom: Atom = {atomZ, label, position};
					structures[0].atoms.push(atom);
				}

				else throw Error(`Invalid line "${line}"`);
			}
		}
		if(rdnatoms > 0 && rdnatoms !== structures[0].atoms.length) {
			throw Error(`Expected ${rdnatoms} atoms, read ${structures[0].atoms.length}`);
		}

		return structures;
	}
}
