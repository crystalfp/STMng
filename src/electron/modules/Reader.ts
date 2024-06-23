/**
 * Read atomic structure file.
 *
 * @packageDocumentation
 * @remarks The original idea was to dynamically load the format reader, but this does not work
 * in production (does not find the reader code).
 *
 * @author Mario Valle {@link "mvalle@ikmail.com"}
 */
import {ipcMain} from "electron";
import log from "electron-log";
import type {ReaderStructure, Structure} from "../../types";
// import type {ReaderImplementation, Constructable} from "../types";

// Import the readers
import {ReaderXYZ} from "../readers/ReadXYZ";
import {ReaderSHELX} from "../readers/ReadSHELX";
import {ReaderPOSCAR} from "../readers/ReadPOSCAR";
import {ReaderCIF} from "../readers/ReadCIF";
import {ReaderCHGCAR} from "../readers/ReadCHGCAR";
import {ReaderLAMMPS} from "../readers/ReadLAMMPS";
import {ReaderLAMMPStrj} from "../readers/ReadLAMMPStrj";
import {ReaderGAUSSIAN} from "../readers/ReadGAUSSIAN";

import {readAuxXDATCAR} from "../readers/AuxXDATCAR";

/**
 * Read structure file in a given format
 *
 * @param filename - File to read
 * @param requestedFormat - Format to use to read the file
 * @param atomsTypes - Atoms types to assign to atoms read
 * @returns Structure read and eventual error message
 */
const readFileStructure = async (filename: string,
								 requestedFormat: string,
								 atomsTypes: string,
								 useBohr: boolean): Promise<ReaderStructure> => {

	// const associatedFilename = getAssociatedFile(filename, type);

	// if(associatedFilename) console.log(associatedFilename);

	let reader;
	try {

		// const {Reader} = await import(`../readers/Read${type}.ts`) as {Reader: Constructable<ReaderImplementation>};

		// reader = new Reader();
		switch(requestedFormat) {
			case "XYZ":
				reader = new ReaderXYZ();
				break;
			case "Shel-X":
				reader = new ReaderSHELX();
				break;
			case "LAMMPS":
				reader = new ReaderLAMMPS();
				break;
			case "LAMMPStrj":
				reader = new ReaderLAMMPStrj();
				break;
			case "POSCAR":
			case "POSCAR + XDATCAR":
				reader = new ReaderPOSCAR();
				break;
			case "CIF":
				reader = new ReaderCIF();
				break;
			case "CHGCAR":
				reader = new ReaderCHGCAR();
				break;
			case "Gaussian Cube":
				reader = new ReaderGAUSSIAN();
				break;
			default: throw Error("Invalid format");
		}
	}
	catch(error) {
		const message = `${requestedFormat} format not implemented. Error: ${(error as Error).message}`;
		log.error(message);
		return {structures: [], error: message};
	}

	if(requestedFormat === "POSCAR" ||
	   requestedFormat === "POSCAR + XDATCAR" ||
	   requestedFormat === "CHGCAR" ||
	   requestedFormat === "LAMMPS" ||
	   requestedFormat === "LAMMPStrj") {
		const atomsTypesTrimmed = atomsTypes.trim();
		const atoms = atomsTypesTrimmed === "" ? [] : atomsTypesTrimmed.split(/ +/);
		const structures1 = await reader.readStructure(filename, {atomsTypes: atoms});
		return checkStructures(structures1) ?
					{structures: structures1} :
					{structures: [], error: `Invalid ${requestedFormat} file`};
	}

	const structures = await reader.readStructure(filename, {useBohr});
	return checkStructures(structures) ?
				{structures} :
				{structures: [], error: `Invalid ${requestedFormat} formatted file`};
};

/**
 * Sanity check for the structures read
 *
 * @param structures - Structures read
 * @returns True if the structures are valid
 */
const checkStructures = (structures: Structure[]): boolean => {

	if(structures.length === 0) return false;
	for(const structure of structures) {
		if(structure.atoms.length === 0) return false;
	}
	return true;
};

/**
 * Read the auxiliary file and update the structures
 *
 * @param filename - Name of the auxiliary file
 * @param mainFormat - Format of the structure file
 * @returns Structure read and eventual error message
 */
const readAuxFile = async (filename: string,
						   mainFormat: string,
						   mainStructure: Structure): Promise<ReaderStructure> => {

	try {
		// eslint-disable-next-line sonarjs/no-small-switch
		switch(mainFormat) {
			case "POSCAR + XDATCAR":
				return {structures: await readAuxXDATCAR(filename, mainStructure)};
			default:
				throw Error(`Format "${mainFormat}" has no auxiliary file`);
		}
	}
	catch(error) {
		return {structures: [], error: (error as Error).message};
	}
};

/**
 * Setup channels for readers
 */
export const setupChannelReader = (): void => {

	ipcMain.handle("READER:READ", async (_event, filename: string,
										 format: string, atomsTypes: string, useBohr: boolean) => {

		if(filename) return JSON.stringify(await readFileStructure(filename, format, atomsTypes, useBohr));
		return "";
	});

	ipcMain.handle("READER:READ-AUX", async (_event, filename: string, format: string, structureEncoded: string) => {

		if(filename) {
			const structure = JSON.parse(structureEncoded) as Structure;
			return JSON.stringify(await readAuxFile(filename, format, structure));
		}
		return "";
	});
};
