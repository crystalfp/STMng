/**
 * Reader for POSCAR formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {fractionalToCartesianCoordinates} from "../modules/Helpers";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, Atom, PositionType,
			 ReaderImplementation, ReaderOptions} from "@/types";

/** Line read type */
const LineType = {
	__proto__: undefined,
    comment: 0,
    scale:   1,
    basis:   2,
    counts:  3,
    direct:  4,
    atoms:   5,
	exit:    6
} as const;


export class ReaderPOSCAR implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 * @throws Error.
	 * "Invalid scale factor"
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structures: Structure[] = [];
		let scaleFactor = 1;
		let lineType: number = LineType.comment;
		let base = 0;
		const atomsCount: number[] = [];
		const atomsZ: number[] = [];
		let currentIdx = 0;
		let currentCount = 0;
		let currentStep = -1;
		let cartesian = false;
		let atomIdx = 0;

		const stream = createInterface(createReadStream(filename, {encoding: "utf8"}));
		for await (const lineRaw of stream) {

			// Remove comments and "selective" line
			const pos = lineRaw.indexOf("!");
			const line = (pos === -1) ? lineRaw.trim() : lineRaw.slice(0, pos).trim();
			if(line.toLowerCase().startsWith("sel")) continue;

			switch(lineType) {

				case LineType.comment:
					lineType = LineType.scale;
					break;

				case LineType.scale: {
					if(line.trim() === "") {
						lineType = LineType.exit;
						break;
					}
					const fields = line.trim().split(/\s+/);
					if(fields.length === 0 || fields.length > 1) {
						lineType = LineType.exit;
						break;
					}
					structures.push(new EmptyStructure());
					++currentStep;
					structures[currentStep].extra.step = currentStep+1;

					scaleFactor = Number.parseFloat(fields[0]);
					if(scaleFactor === 0) {
						throw Error("Invalid scale factor");
					}
					atomsZ.length = 0;
					base = 0;
					lineType = LineType.basis;
					break;
				}

				case LineType.basis: {

					const fields = line.trim().split(/\s+/);
					const {basis} = structures[currentStep].crystal;
					basis[base]   = Number.parseFloat(fields[0]);
					basis[base+1] = Number.parseFloat(fields[1]);
					basis[base+2] = Number.parseFloat(fields[2]);
					base += 3;
					if(base === 9) {
						lineType = LineType.counts;
						base = 0;

						// If scale is negative, it is the unit cell volume,
						// so transform it into a scale factor
						if(scaleFactor < 0) {
							const Vuc = basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
										basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
										basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7];
							scaleFactor = Math.cbrt(-scaleFactor/Vuc);
						}

						// Adjust the basis scale
						if(scaleFactor !== 1) {

							for(let j=0; j < 9; ++j) {
								basis[j] *= scaleFactor;
							}
						}
					}
					break;
				}

				case LineType.counts: {
					const fields = line.trim().split(/\s+/);
					if(/\d+/.test(fields[0])) {
						// Line with atoms count. Put them in an array
						atomsCount.length = 0;
						for(const field of fields) {
							const count = Number.parseInt(field, 10);
							if(count > 0) atomsCount.push(count);
						}

						// Already has the atoms types
						if(atomsZ.length > 0) {
							lineType = LineType.direct;
							break;
						}

						// If has types from the UI
						const countAtomsTypes = atomsCount.length;
						if(options?.atomsTypes?.length) {
							const {atomsTypes} = options;
							for(const atomType of atomsTypes) {
								atomsZ.push(getAtomicNumber(atomType));
							}

							// Not sufficient substitutes
							const countSubstituteTypes = atomsTypes.length;
							if(countSubstituteTypes < countAtomsTypes) {
								let nextAtomZ = Math.max(...atomsZ) + 1;
								for(let i=countSubstituteTypes; i < countAtomsTypes; ++i) {
									atomsZ.push(nextAtomZ);
									++nextAtomZ;
								}
							}
						}
						else {
							// Has no types from the UI
							for(let atomZ=1; atomZ <= countAtomsTypes; ++atomZ) {
								atomsZ.push(atomZ);
							}
						}

						lineType = LineType.direct;
					}
					else {
						for(const field of fields) {
							atomsZ.push(getAtomicNumber(field));
						}
						// No new lineType. Read the number of atoms per type
					}
					break;
				}

				case LineType.direct: {
					const kind = line.trim().toLowerCase();
					if(kind.startsWith("dir")) {
						lineType = LineType.atoms;
						currentIdx = 0;
						currentCount = atomsCount[0];
						cartesian = false;
					}
					else if(kind.startsWith("car") || kind.startsWith("kar")) {
						lineType = LineType.atoms;
						currentIdx = 0;
						currentCount = atomsCount[0];
						cartesian = true;
					}
					atomIdx = 0;
					break;
				}

				case LineType.atoms: {
					const fields = line.trim().split(/\s+/);
					const position = cartesian ? [
											Number.parseFloat(fields[0]) * scaleFactor,
											Number.parseFloat(fields[1]) * scaleFactor,
											Number.parseFloat(fields[2]) * scaleFactor,
										] as PositionType :
										fractionalToCartesianCoordinates(
											structures[currentStep].crystal.basis,
											Number.parseFloat(fields[0]),
											Number.parseFloat(fields[1]),
											Number.parseFloat(fields[2]),
										);
					const atomZ = atomsZ[currentIdx];
					const atom: Atom = {
						atomZ,
						label: "Atom" + atomIdx.toString(),
						chain: "",
						position
					};
					structures[currentStep].atoms.push(atom);
					--currentCount;
					++atomIdx;
					if(currentCount === 0) {
						++currentIdx;
						if(currentIdx < atomsCount.length) {
							currentCount = atomsCount[currentIdx];
						}
						else {
							lineType = LineType.comment;
						}
					}
				}
			}
			if(lineType === LineType.exit) break;
		}

		return structures;
	}
}
