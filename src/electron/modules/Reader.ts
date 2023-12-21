/**
 * Read chemical structure file.
 * The original idea was to dynamically load the format reader, but does not work
 * in production (does not find the reader code)
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import path from "node:path";
import fs from "node:fs";
import log from "electron-log";
import type {ReaderStructure} from "../../types";
// import type {ReaderImplementation, Constructable} from "../types";

// Import the readers
import {Reader as ReaderXYZ} from "../readers/ReadXYZ";
import {Reader as ReaderSHELX} from "../readers/ReadSHELX";

/**
 * Get the loaded file format
 *
 * @param filename - Loaded filename
 * @returns The format as uppercase string
 */
const getFileFormat = (filename: string): string => {

	const ext = path.extname(filename).toLowerCase();

	// Formats that are coded in the extension
	switch(ext) {
		case ".pdb":  		return "PDB";
		case ".spf":  		return "SPF";
		case ".ins":
		case ".res":  		return "SHELX";
		case ".xyz":  		return "XYZ";
		case ".cif":  		return "CIF";
		case ".mol2": 		return "MOL2";
		case ".poscar":
		case ".poscars":	return "POSCAR";
	}

	// Formats that have the format code in the filename
	const base = path.basename(filename).toLowerCase();
	if(base.includes("poscar")) return "POSCAR";
	if(base.includes("chgcar")) return "CHGCAR";

	// No known extension
	return "";
};

const getAssociatedFile = (filename: string, format: string): string => {

	let extAssociated = "";
	switch(format) {
		case "xyz":
			extAssociated = "cell";
			break;
		case "cell":
			extAssociated = "xyz";
			break;
	}

	if(extAssociated) {
		const associatedFilename = `${path.dirname(filename)}/${path.basename(filename)}.${extAssociated}`;
		if(fs.existsSync(associatedFilename)) return associatedFilename;
	}
	return "";
};


export const readStructure = async (filename: string): Promise<ReaderStructure> => {

	const type = getFileFormat(filename);
	const associatedFilename = getAssociatedFile(filename, type);

	if(associatedFilename) console.log(associatedFilename);

	let reader;
	try {

		// const {Reader} = await import(`../readers/Read${type}.ts`) as {Reader: Constructable<ReaderImplementation>};

		// reader = new Reader();
		switch(type) {
			case "XYZ":
				reader = new ReaderXYZ();
				break;
			case "SHELX":
				reader = new ReaderSHELX();
				break;
			default: throw Error("Invalid format");
		}
	}
	catch(error: unknown) {
		log.error(`${type} format not implemented`, (error as Error).message);
		return {filename: "", structures: [], error: `${type} format not implemented`};
	}

	const structures = await reader.readStructure(filename);

	return {
		filename: path.basename(filename),
		structures
	};
};

export const setupChannelReader = (): void => {

	ipcMain.handle("READER:READ", async () => {
		const file = dialog.showOpenDialogSync({
			title: "Select input",
			properties: ["openFile"],
			filters: [
				{name: "PDB", extensions: ["pdb"]},
				{name: "POSCAR", extensions: ["poscar", "poscars"]},
				{name: "XYZ", extensions: ["xyz"]},
				{name: "ShelX", extensions: ["ins", "res"]},
				{name: "All", extensions: ["*"]},
			]
		});
		if(file) return JSON.stringify(await readStructure(file[0]));
		return JSON.stringify({filename: "", structures: [], error: "Cannot read"});
	});
};
