/**
 * Save a screen capture
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";
import fs from "node:fs";

/**
 * Setup the channels to save a scene snapshot
 */
export const setupChannelSnapshot = (): void => {

    ipcMain.handle("VIEWER:SNAPSHOT",  (_event, dataURI: string) => {

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

	// TBD Add save movie
};
