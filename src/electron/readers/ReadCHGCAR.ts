/**
 * Reader for CHGCAR formatted files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import fs from "node:fs";
import {createInterface} from "node:readline/promises";
import {getAtomicNumber} from "../modules/AtomData";
import {fractionalToCartesianCoordinates} from "../modules/Helpers";
import type {Structure, Atom, PositionType,
			 ReaderImplementation, ReaderOptions} from "@/types";
import {EmptyStructure} from "../modules/EmptyStructure";

/** Line read type */
enum LineType {
    comment,
    scale,
    basis,
    counts,
    direct,
    atoms,
    blank,
    volumeCount,
    volumeValues,
	exit,
}

export class ReaderCHGCAR implements ReaderImplementation {

	/**
	 * Read the structures from the file
	 *
	 * @param filename - File to be read
	 * @param options - Options for the reader
	 * @returns The set of structures read
	 */
	async readStructure(filename: string, options?: ReaderOptions): Promise<Structure[]> {

		const structures: Structure[] = [];
		let scaleFactor = 1;
		let lineType: LineType = LineType.comment;
		let base = 0;
		const atomsCount: number[] = [];
		const atomsZ: number[] = [];
		let currentIdx = 0;
		let currentCount = 0;
		let currentStructure = -1;
		let cartesian = false;
		let totalPoints = 0;
		let volume: number[] = [];
		let volumeIndex = 0;

		const stream = createInterface(fs.createReadStream(filename));
		for await (const line of stream) {

			switch(lineType) {
				case LineType.comment:
					lineType = LineType.scale;
					break;
				case LineType.scale:
					if(line.trim() === "") break;
					structures.push(new EmptyStructure());
					++currentStructure;
					scaleFactor = Number.parseFloat(line);
					lineType = LineType.basis;
					break;
				case LineType.basis: {
					const fields = line.trim().split(/\s+/);
					const {basis} = structures[currentStructure].crystal;
					basis[base]   = Number.parseFloat(fields[0]);
					basis[base+1] = Number.parseFloat(fields[1]);
					basis[base+2] = Number.parseFloat(fields[2]);
					base += 3;
					if(base === 9) {
						lineType = LineType.counts;
						base = 0;

						// If scale is negative, it is the unit cell volume, so transform it into a scale factor
						if(scaleFactor < 0) {
							const Vuc = basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
										basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
										basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7];
							scaleFactor = Math.cbrt(-scaleFactor/Vuc);
						}
						else if(scaleFactor === 0) {
							throw Error("Invalid scale factor");
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
							atomsCount.push(count);
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
						// No new line type. Read the number of atoms per type
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
					else {
						lineType = LineType.exit;
					}
					break;
				}
				case LineType.atoms: {
					const fields = line.trim().split(/\s+/);
					if(fields.length < 3) {
						lineType = LineType.exit;
						break;
					}

					const position = cartesian ? [
											Number.parseFloat(fields[0]) * scaleFactor,
											Number.parseFloat(fields[1]) * scaleFactor,
											Number.parseFloat(fields[2]) * scaleFactor,
										] as PositionType :
										fractionalToCartesianCoordinates(
											structures[currentStructure].crystal.basis,
											Number.parseFloat(fields[0]),
											Number.parseFloat(fields[1]),
											Number.parseFloat(fields[2]),
										);
					const atomZ = atomsZ[currentIdx];
					const atom: Atom = {
						atomZ,
						label: "Atom" + currentIdx.toString(),
						position
					};
					structures[currentStructure].atoms.push(atom);
					--currentCount;
					if(currentCount === 0) {
						++currentIdx;
						if(currentIdx < atomsCount.length) {
							currentCount = atomsCount[currentIdx];
						}
						else {
							lineType = LineType.blank;
						}
					}
					break;
				}
				case LineType.blank:
					lineType = LineType.volumeCount;
					break;
				case LineType.volumeCount: {
					const fields = line.trim().split(/\s+/);
					if(fields.length !== 3) break;

					const sides: PositionType = [
						Number.parseInt(fields[0], 10),
						Number.parseInt(fields[1], 10),
						Number.parseInt(fields[2], 10)
					];
					if(Number.isNaN(sides[0]) || sides[0] <= 0 ||
					   Number.isNaN(sides[1]) || sides[1] <= 0 ||
					   Number.isNaN(sides[2]) || sides[2] <= 0) {
						break;
					}
					if(structures[currentStructure].volume.length > 0) {
						const previousSides = structures[currentStructure].volume.at(-1)!.sides;
						if(sides[0] !== previousSides[0] ||
						   sides[1] !== previousSides[1] ||
						   sides[2] !== previousSides[2]) {
							break;
						}
					}
					volumeIndex = 0;
					totalPoints = sides[0]*sides[1]*sides[2];
					structures[currentStructure].volume.push({
						sides,
						values: Array(totalPoints).fill(0) as number[]
					});
					volume = structures[currentStructure].volume.at(-1)!.values;
					lineType = LineType.volumeValues;
					break;
				}
				case LineType.volumeValues: {
					const fields = line.trim().split(/\s+/);
					for(const field of fields) {
						volume[volumeIndex++] = Number.parseFloat(field);
					}
					totalPoints -= fields.length;
					if(totalPoints === 0) lineType = LineType.volumeCount;
					break;
				}
			}
			if(lineType === LineType.exit) break;
		}

		return structures;
	}
}
