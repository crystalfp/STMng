/**
 * Save a screen capture as an image or a movie or save the displayed structure as a STL file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import {ipcMain, dialog, app} from "electron";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import {execSync} from "node:child_process";
import tmp from "tmp";
import {fileURLToPath} from "node:url";

/**
 * Setup the channels to save a scene snapshot or a movie or a STL file
 */
export const setupChannelCapture = (): void => {

    ipcMain.handle("VIEWER:SNAPSHOT", (_event, dataURI: string) => {

		// Split the dataURI and extract the image format
		const data = dataURI.split(",");
		let format = data[0].replace(/data:image\/([^;]*);base64/, "$1"); // data:image/jpeg;base64
		if(format === "jpeg") format = "jpg";

		// Select the save file
		const filename = dialog.showSaveDialogSync({
			title: "Save snapshot file",
			defaultPath: `snapshot.${format}`,
			filters: [{name: format, extensions: [format]}]
		});
		if(!filename) return {payload: ""};

		// Save the image
		try {
			fs.writeFileSync(filename, Buffer.from(data[1], "base64"));
			return {payload: filename};
		}
		catch(error) {
			return {payload: "Error",
				    error: `Cannot save image file "${filename}". Error: ${(error as Error).message}`};
		}
    });

	ipcMain.handle("VIEWER:MOVIE", (_event, buffer: ArrayBuffer) => {

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
			catch(error) {
				return {payload: "Error",
						error: `Cannot save temporary movie file. Error: ${(error as Error).message}`};
			}

			// Select the platform executable
			let ffmpegExe;
			const platform = os.platform();
			switch(platform) {
				case "win32":
					ffmpegExe = "ffmpeg.exe";
					break;
				case "linux":
					ffmpegExe = "ffmpeg";
					break;
				default:
					return {payload: "Error", error: `Platform "${platform}" not supported`};
			}

			// Find the ffmpeg executable
			const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
			const ffmpeg = app.isPackaged ?
								path.resolve(process.resourcesPath,
											 `app.asar.unpacked/dist/bin/${ffmpegExe}`) :
								path.join(mainSourceDirectory, "..", "public", "bin", ffmpegExe);

			// Setup movie format specific options
			const opt = format === ".mp4" ?
								"-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov" : "";

			// Call ffmpeg to do the format conversion
			try {
				execSync(`"${ffmpeg}" -y -i ${webmFile} ${opt} ${filename}`, {windowsHide: true});
				void fs.remove(webmFile);
				return {payload: filename};
			}
			catch(error) {
				return {payload: "Error",
						error: `Cannot convert movie file. Error: ${(error as Error).message}`};
			}
		}
		try {
			fs.writeFileSync(filename, Buffer.from(buffer));
			return {payload: filename};
		}
		catch(error) {
			return {payload: "Error",
					error: `Cannot save movie file "${filename}". Error: ${(error as Error).message}`};
		}
	});

	ipcMain.handle("VIEWER:STL", (_event, content: string | ArrayBuffer, binary: boolean) => {

		// Select the save file
		const filename = dialog.showSaveDialogSync({
			title: "Save STL geometry file",
			defaultPath: "geometry.stl",
			filters: [{name: "STL", extensions: ["stl"]}]
		});
		if(!filename) return {payload: ""};

		try {
			if(binary) fs.writeFileSync(filename, Buffer.from(content as ArrayBuffer));
			else       fs.writeFileSync(filename, content as string, "utf8");
			return {payload: filename};
		}
		catch(error) {
			return {payload: "Error",
					error: `Cannot save STL file "${filename}". Error: ${(error as Error).message}`};
		}
	});
};
