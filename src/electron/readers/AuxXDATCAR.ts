/**
 * Reader for XDATCAR auxiliary files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
import {fractionalToCartesianCoordinates} from "../modules/Helpers";
import type {Structure} from "@/types";

/**
 * Line read type
 * @notExported
 */
const LineType = {
    header:    0,
    separator: 1,
    position:  2,
} as const;

/**
 * Line read type
 * @notExported
 */
type Step = (typeof LineType)[keyof typeof LineType];

/**
 * Read the auxiliary file XDATCAR
 *
 * @param filename - Filename to be read as XDATCAR
 * @param mainStructures - The already read main structure
 * @param append - If these steps should be appended to the main structure
 * @returns Main structures trajectory
 * @throws Error.
 * "Missing main structure" or "Empty main structure" or "ENOENT: no such file or directory"
 */
export const readAuxXDATCAR = async (filename: string,
									 mainStructures: Structure[],
									 append: boolean): Promise<Structure[]> => {

	// Sanity check
	const mainLength = mainStructures?.length ?? 0;
	if(mainLength === 0) throw Error("Missing main structures");

	const {crystal, atoms} = mainStructures[mainLength-1];
	const natoms = atoms.length;
	if(natoms === 0) throw Error("Empty main structure");

	let lineType: Step = LineType.header;
	let headerLines = 5;
	let index = 0;
	let structure: Structure;

	// Remove the model structure
	let structures: Structure[];
	if(append) {
		structures = structuredClone(mainStructures);
		structures.pop();
	}
	else structures = [];

	const stream = createInterface(createReadStream(filename, {encoding: "utf8"}));
	for await (const line of stream) {

		switch(lineType) {
			case LineType.header:
				--headerLines;
				if(headerLines === 0) lineType = LineType.separator;
				break;
			case LineType.separator:
				lineType = LineType.position;
				index = 0;
				break;
			case LineType.position: {
				if(index === 0) {
					structure = {
						crystal: {
							basis: [
								crystal.basis[0],
								crystal.basis[1],
								crystal.basis[2],
								crystal.basis[3],
								crystal.basis[4],
								crystal.basis[5],
								crystal.basis[6],
								crystal.basis[7],
								crystal.basis[8]
							],
							origin: [
								crystal.origin[0],
								crystal.origin[1],
								crystal.origin[2],
							],
							spaceGroup: crystal.spaceGroup
						},
						atoms: [],
						bonds: [],
						volume: [],
						extra: {step: structures.length+1}
					};
					structures.push(structure);
				}
				const fields = line.trim().split(/\s+/);

				if(/\d+/.test(fields[0])) {
					const position = fractionalToCartesianCoordinates(
										crystal.basis,
										Number.parseFloat(fields[0]),
										Number.parseFloat(fields[1]),
										Number.parseFloat(fields[2]),
									);

					structure!.atoms.push({
						atomZ: atoms[index].atomZ,
						label: atoms[index].label,
						chain: atoms[index].chain,
						position
					});
				}
				else throw Error("Invalid XDATCAR format (non numeric position)");

				++index;
				if(index === natoms) lineType = LineType.separator;
				break;
			}
		}
	}

	return structures;
};
