/**
 * Reader for XDATCAR auxiliary files
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {createReadStream} from "node:fs";
import {createInterface} from "node:readline/promises";
import {fractionalToCartesianCoordinates} from "../modules/Helpers";
import type {Structure} from "@/types";

/** Line read type */
enum LineType {
    header,
    separator,
    position,
}

/**
 * Read the auxiliary file XDATCAR
 *
 * @param filename - Filename to be read as XDATCAR
 * @param mainStructure - The already read main structure
 * @returns Main structures trajectory
 * @throws Error.
 * "Missing main structure" or "Empty main structure" or "ENOENT: no such file or directory"
 */
export const readAuxXDATCAR = async (filename: string, mainStructure: Structure): Promise<Structure[]> => {

	// Sanity check
	if(!mainStructure?.atoms) throw Error("Missing main structure");
	const {crystal, atoms} = mainStructure;
	const natoms = atoms.length;
	if(natoms === 0) throw Error("Empty main structure");
	let lineType: LineType = LineType.header;
	let headerLines = 5;
	let index = 0;
	const structures: Structure[] = [];
	let structure: Structure;

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
						extra: {id: structures.length+1}
					};
					structures.push(structure);
				}
				const fields = line.trim().split(/\s+/);

				const position = fractionalToCartesianCoordinates(
									crystal.basis,
									Number.parseFloat(fields[0]),
									Number.parseFloat(fields[1]),
									Number.parseFloat(fields[2]),
								 );

				structure!.atoms.push({
					atomZ: atoms[index].atomZ,
					label: atoms[index].label,
					position
				});
				++index;
				if(index === natoms) lineType = LineType.separator;
				break;
			}

			default: break;
		}
	}

	return structures;
};
