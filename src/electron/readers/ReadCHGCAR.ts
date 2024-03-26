/**
 * Reader for CHGCAR formatted files
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import * as rd from "node:readline/promises";
import {getAtomicNumber, getAtomicSymbol} from "../modules/AtomData";
import {fractionalToCartesianCoordinates, getStructureAppearanceFromZ} from "../modules/ReaderWriterHelpers";
import type {ReaderImplementation} from "../types";
import type {Structure, Atom, PositionType} from "../../types";

/** Line read type */
const enum LineType {
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
	 * @param atomsTypes - Optional atoms types to be used (normally they are not in the file)
	 * @returns The set of structure read
	 */
	async readStructure(filename: string, atomsTypes?: string[]): Promise<Structure[]> {

		const structures: Structure[] = [];
		let scaleFactor = 1;
		let lineType: LineType = LineType.comment;
		let base = 0;
		const atomsCount: number[] = [];
		const atomsKinds: string[] = [];
		const atomsZ: number[] = [];
		let currentIdx = 0;
		let currentCount = 0;
		let currentStep = -1;
		let cartesian = false;
		let totalPoints = 0;
		let volume: number[] = [];
		let volumeIndex = 0;

		const stream = rd.createInterface(fs.createReadStream(filename));
		for await (const line of stream) {

			switch(lineType) {
				case LineType.comment:
					lineType = LineType.scale;
					break;
				case LineType.scale:
					if(line.trim() === "") break;
					structures.push({
						crystal: {
							basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
							origin: [0, 0, 0],
							spaceGroup: ""
						},
						atoms: [],
						bonds: [],
						look: {},
						volume: []
					});
					++currentStep;
					scaleFactor = Number.parseFloat(line);
					lineType = LineType.basis;
					break;
				case LineType.basis: {
					const fields = line.trim().split(/ +/);
					const {basis} = structures[currentStep].crystal;
					basis[base*3]   = Number.parseFloat(fields[0]);
					basis[base*3+1] = Number.parseFloat(fields[1]);
					basis[base*3+2] = Number.parseFloat(fields[2]);
					++base;
					if(base === 3) {
						lineType = LineType.counts;
						base = 0;

						// If scale is negative, it is the unit cell volume, so transform it into a scale factor
						if(scaleFactor < 0) {
							const Vuc = basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
										basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
										basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7];
							scaleFactor = Math.pow((-scaleFactor)/Vuc, 1/3);
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
					const fields = line.trim().split(/ +/);
					if(/\d+/.test(fields[0])) {
						let atomZ = 1;
						const hasSymbols = atomsZ.length > 0;
						atomsCount.length = 0;
						let idx = 0;
						for(const field of fields) {
							const count = Number.parseInt(field);
							atomsCount.push(count);
							if(!hasSymbols) {
								if(atomsTypes?.length) {
									atomsZ.push(getAtomicNumber(atomsTypes[idx]));
									atomsKinds.push(atomsTypes[idx]);
									++idx;
									if(idx === atomsTypes.length) idx = 0;
								}
								else {
									atomsZ.push(atomZ);
									atomsKinds.push(getAtomicSymbol(atomZ));
									++atomZ;
								}
							}
						}
						lineType = LineType.direct;
					}
					else {
						for(const field of fields) {
							atomsKinds.push(field);
							atomsZ.push(getAtomicNumber(field));
						}
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

					break;
				}
				case LineType.atoms: {
					const fields = line.trim().split(/ +/);

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
						label: atomsKinds[currentIdx],
						position
					};
					structures[currentStep].atoms.push(atom);
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
					const fields = line.trim().split(/ +/);
					if(fields.length < 3) {
						lineType = LineType.exit;
						break;
					}
					const sides: PositionType = [
						Number.parseInt(fields[0]),
						Number.parseInt(fields[1]),
						Number.parseInt(fields[2])
					];
					if(Number.isNaN(sides[0]) || sides[0] <= 0 ||
					   Number.isNaN(sides[1]) || sides[1] <= 0 ||
					   Number.isNaN(sides[2]) || sides[2] <= 0) {
						lineType = LineType.exit;
						break;
					}
					if(structures[currentStep].volume.length > 0) {
						const previousSides = structures[currentStep].volume.at(-1)!.sides;
						if(sides[0] !== previousSides[0] ||
						   sides[1] !== previousSides[1] ||
						   sides[2] !== previousSides[2]) {
							lineType = LineType.exit;
							break;
						}
					}
					volumeIndex = 0;
					totalPoints = sides[0]*sides[1]*sides[2];
					structures[currentStep].volume.push({
						sides,
						values: Array(totalPoints).fill(0) as number[]
					});
					volume = structures[currentStep].volume.at(-1)!.values;
					lineType = LineType.volumeValues;
					break;
				}
				case LineType.volumeValues: {
					const fields = line.trim().split(/ +/);
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

		// Add appearance to the structure
		for(const structure of structures) {
			structure.look  = getStructureAppearanceFromZ(atomsZ);
		}

		return structures;
	}
}
