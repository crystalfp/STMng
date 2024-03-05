/**
 * Write atomic structure file.
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import log from "electron-log";
import type {Structure} from "../../types";

import {WriterXYZ} from "../writers/WriteXYZ";
import {WriterPOSCAR} from "../writers/WritePOSCAR";
import {WriterSHELX} from "../writers/WriteSHELX";
import {WriterCHGCAR} from "../writers/WriteCHGCAR";
import {WriterCIF} from "../writers/WriteCIF";

/**
 * Setup channels for writer
 */
export const setupChannelWriter = (): void => {

	ipcMain.handle("WRITER:SELECT", (_event, format: string) => {

		// Set filter
		let filters;
		switch(format) {
			case "CHGCAR":
				filters = [{name: "CHGCAR",	extensions: ["chgcar"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "CIF":
				filters = [{name: "CIF",	extensions: ["cif"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "POSCAR":
				filters = [{name: "POSCAR",	extensions: ["poscar"]},
						   {name: "All",	extensions: ["*"]}];
				break;
			case "Shel-X":
				filters = [{name: "Shel-X",	extensions: ["res"]},
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
		const file = dialog.showSaveDialogSync({
			title: "Select output structure file",
			filters
		});

		if(file) return file.replaceAll("\\", "/");
		return "";
	});

	ipcMain.handle("WRITER:WRITE", (_event, format: string,
									filename: string, encodedStructures: string) => {

		let writer;
		try {

			// const {Writer} = await import(`../readers/Write${type}.ts`) as {Writer: Constructable<WriterImplementation>};
			// reader = new Writer();

			switch(format) {
				case "XYZ":
					writer = new WriterXYZ();
					break;
				case "Shel-X":
					writer = new WriterSHELX();
					break;
				case "POSCAR":
					writer = new WriterPOSCAR();
					break;
				case "CIF":
					writer = new WriterCIF();
					break;
				case "CHGCAR":
					writer = new WriterCHGCAR();
					break;
				default: throw Error("Invalid format");
			}
		}
		catch(error: unknown) {
			const message = `${format} format not implemented. Error: ${(error as Error).message}`;
			log.error(message);
			return {payload: "Error", error: message};
		}

		const structures = JSON.parse(encodedStructures) as Structure[];

		const sts = writer!.writeStructure(filename, structures);
		if(sts.error) {
			const message = `Error writing "${filename}" file in ${format} format. Error: ${sts.error}`;
			log.error(message);
		}
		return sts;
	});
};
