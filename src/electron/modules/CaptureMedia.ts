/**
 * Save a screen capture
 *
 * @packageDocumentation
 */
import {ipcMain, dialog} from "electron";
import fs from "fs-extra";
import path from "node:path";
import {execSync} from "node:child_process";
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
				{name: "avi",  extensions: ["avi"]},
			]
		});
		if(!filename) return {payload: ""};

		const format = path.extname(filename);
		if(format !== ".webm") {

			// Save the movie to a temporary WEBM formatted file
			const webmFile = tmp.tmpNameSync({prefix: "stm-ng", postfix: ".webm"});
			try {
				fs.writeFileSync(webmFile, Buffer.from(buffer));
			}
			catch(error: unknown) {
				return {payload: "Error",
						error: `Cannot save temporary movie file. Error: ${(error as Error).message}`};
			}

			// Call ffmpeg to do the format conversion
			try {
				const opt = format === ".mp4" ? "-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov" : "";
				execSync(`ffmpeg -y -i ${webmFile} ${opt} ${filename}`, {windowsHide: true});
				void fs.remove(webmFile);
				return {payload: filename};
			}
			catch(error: unknown) {
				return {payload: "Error",
						error: `Cannot convert movie file. Error: ${(error as Error).message}`};
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
