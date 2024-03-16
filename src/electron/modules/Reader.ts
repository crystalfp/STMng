/**
 * Read atomic structure file.
 * @remarks The original idea was to dynamically load the format reader, but this does not work
 * in production (does not find the reader code)
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import path from "node:path";
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
								 atomsTypes: string): Promise<ReaderStructure> => {

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
				reader = new ReaderPOSCAR();
				break;
			case "CIF":
				reader = new ReaderCIF();
				break;
			case "CHGCAR":
				reader = new ReaderCHGCAR();
				break;
			default: throw Error("Invalid format");
		}
	}
	catch(error: unknown) {
		const message = `${requestedFormat} format not implemented. Error: ${(error as Error).message}`;
		log.error(message);
		return {filename: "", structures: [], error: message};
	}

	if(requestedFormat === "POSCAR" ||
	   requestedFormat === "CHGCAR" ||
	   requestedFormat === "LAMMPS" ||
	   requestedFormat === "LAMMPStrj") {
		const atomsTypesTrimmed = atomsTypes.trim();
		const atoms = atomsTypesTrimmed === "" ? [] : atomsTypesTrimmed.split(/ +/);
		const structures1 = await reader.readStructure(filename, atoms);
		const file1 = path.basename(filename);
		return checkStructures(structures1) ?
					{filename: file1, structures: structures1} :
					{filename: file1, structures: [], error: `Invalid ${requestedFormat} file`};
	}

	const structures = await reader.readStructure(filename);
	const file = path.basename(filename);
	return checkStructures(structures) ?
				{filename: file, structures} :
				{filename: file, structures: [], error: `Invalid ${requestedFormat} formatted file`};
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
 * Setup channels for readers
 */
export const setupChannelReader = (): void => {

	ipcMain.handle("READER:READ", async (_event, format: string, atomsTypes: string) => {

		// Set filter
		let filters;
		switch(format) {
			case "CHGCAR":
				filters = [{name: "CHGCAR",	extensions: ["chgcar", "*"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "CIF":
				filters = [{name: "CIF",	extensions: ["cif"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "LAMMPS":
				filters = [{name: "LAMMPS",	extensions: ["lmp"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "LAMMPStrj":
				filters = [{name: "LAMMPStrj", extensions: ["lammpstrj"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "POSCAR":
				filters = [{name: "POSCAR",	extensions: ["poscar", "poscars", "*"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "Shel-X":
				filters = [{name: "Shel-X",	extensions: ["ins", "res"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "XYZ":
				filters = [{name: "XYZ",	extensions: ["xyz"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			default:
				filters = [{name: "All",	extensions: ["*"]}];
				break;
		}
		const file = dialog.showOpenDialogSync({
			title: "Select input structure file",
			properties: ["openFile"],
			filters
		});
		if(file) return JSON.stringify(await readFileStructure(file[0], format, atomsTypes));
		return "";
	});
};
