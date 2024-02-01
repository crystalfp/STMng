/**
 * Save a screen capture
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import fs from "fs-extra";
import path from "node:path";
import {exec} from "node:child_process";
import tmp from "tmp";

/**
 * Setup the channels to save a scene snapshot or a movie
 */
export const setupChannelCapture = (): void => {

    ipcMain.handle("VIEWER:SNAPSHOT", (_event, dataURI: string) => {

		// Split the dataURI and extract the image format
		const data = dataURI.split(",");
		let format = data[0].replace(/data:image\/([^;]*);base64/, "$1"); // data:image/jpeg;base64
		if(format === "jpeg") format = "jpg";

		// Find the first free filename
		let idx = 0;
		let filename;
		do {
			filename = `./snapshot${idx.toString().padStart(3, "0")}.${format}`;
			++idx;
			if(idx > 999) return {payload: "Error", error: "Cannot find free image file name"};
		} while(fs.existsSync(filename));

		// Save the image
		try {
			fs.writeFileSync(filename, Buffer.from(data[1], "base64"));
			return {payload: filename};
		}
		catch(error: unknown) {
			return {payload: "Error",
				    error: `Cannot save image file "${filename}". Error: ${(error as Error).message}`};
		}
    });

	ipcMain.handle("VIEWER:MOVIE",  (_event, buffer: ArrayBuffer) => {

		const filename = dialog.showSaveDialogSync({
			title: "Save movie",
			filters: [
				{name: "WEBm", extensions: ["webm"]},
				{name: "mp4",  extensions: ["mp4"]},
			]
		});
		if(!filename) return {payload: ""};

		if(path.extname(filename) !== ".webm") {

			const webmFile = tmp.tmpNameSync({postfix: ".webm"});
			try {
				fs.writeFileSync(webmFile, Buffer.from(buffer));

				// eslint-disable-next-line security/detect-child-process
				exec(`ffmpeg -i ${webmFile} ${filename}`, {windowsHide: true}, (error) => {
					if(error) {
						console.error(`exec error: ${error.message}`);
						return;
					}
					fs.removeSync(webmFile);
				});
				return {payload: filename};
			}
			catch(error: unknown) {
				return {payload: "Error",
						error: `Cannot save temporary movie file. Error: ${(error as Error).message}`};
			}
		}
		try {
			fs.writeFileSync(filename, Buffer.from(buffer));
			return {payload: filename};
		}
		catch(error: unknown) {
			return {payload: "Error",
					error: `Cannot save movie file "${filename}". Error: ${(error as Error).message}`};
		}
	});

};
