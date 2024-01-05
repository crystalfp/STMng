/**
 * Read atomic structure file.
 * The original idea was to dynamically load the format reader, but this does not work
 * in production (does not find the reader code)
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import path from "node:path";
import log from "electron-log";
import type {ReaderStructure} from "../../types";
// import type {ReaderImplementation, Constructable} from "../types";

// Import the readers
import {ReaderXYZ} from "../readers/ReadXYZ";
import {ReaderSHELX} from "../readers/ReadSHELX";
import {ReaderPOSCAR} from "../readers/ReadPOSCAR";

export const readFileStructure = async (filename: string,
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
			case "ShelX":
				reader = new ReaderSHELX();
				break;
			case "POSCAR":
				reader = new ReaderPOSCAR();
				break;
			default: throw Error("Invalid format");
		}
	}
	catch(error: unknown) {
		log.error(`${requestedFormat} format not implemented`, (error as Error).message);
		return {filename: "", structures: [], error: `${requestedFormat} format not implemented`};
	}

	if(requestedFormat === "POSCAR") {
		const atoms = atomsTypes.trim().split(/ +/);
		const structures = await reader.readStructure(filename, atoms);
		return {
			filename: path.basename(filename),
			structures
		};
	}

	return {
		filename: path.basename(filename),
		structures: await reader.readStructure(filename)
	};
};

export const setupChannelReader = (): void => {

	ipcMain.handle("READER:READ", async (_event, format: string, atomsTypes: string) => {

		// Set filter
		let filters;
		switch(format) {
			case "POSCAR":
				filters = [{name: "POSCAR",	extensions: ["poscar", "poscars", "*"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "ShelX":
				filters = [{name: "ShelX",	extensions: ["ins", "res"]},
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
			title: "Select input",
			properties: ["openFile"],
			filters
		});
		if(file) return JSON.stringify(await readFileStructure(file[0], format, atomsTypes));
		return "";
	});
};
