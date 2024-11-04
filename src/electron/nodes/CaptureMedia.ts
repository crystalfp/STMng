/**
 * Save a screen capture as an image or a movie or save the displayed structure
 * as a STL file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-08
 */
import {dialog, app} from "electron";
import fs from "node:fs";
import path from "node:path";
import tmp from "tmp";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {execSync} from "node:child_process";

import {NodeCore} from "../modules/NodeCore";
import type {UiInfo, ChannelDefinition, CtrlParams} from "@/types";

export class CaptureView extends NodeCore {

	private readonly channels: ChannelDefinition[] = [
		{name: "snapshot",	type: "invoke", 	callback: this.channelSnapshot.bind(this)},
		{name: "movie",		type: "invoke", 	callback: this.channelMovie.bind(this)},
		{name: "stl",		type: "invoke", 	callback: this.channelSTL.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels("SYSTEM", this.channels);
	}

	saveStatus(): string {
		return "";
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function, sonarjs/no-empty-function
	loadStatus(): void {}

	getUiInfo(): UiInfo {
		return {
			id: this.id,
			ui: "CaptureMediaCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	// > Channel handlers
	/**
	 * Channel handler for taking a screenshot
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelSnapshot(params: CtrlParams): CtrlParams {

		const dataURI = params.dataURI as string;
		if(!dataURI) return {payload: ""};

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
			return {error: `Cannot save image file "${filename}". Error: ${(error as Error).message}`};
		}
	}

	/**
	 * Channel handler for creating a movie
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelMovie(params: CtrlParams): CtrlParams {

		const buffer = params.buffer as ArrayBuffer;
		if(!buffer) return {payload: ""};

		const width = params.width as number;
		const height = params.height as number;

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
				return {error: `Cannot save temporary movie file. Error: ${(error as Error).message}`};
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
					return {error: `Platform "${platform}" is not supported`};
			}

			// Find the ffmpeg executable
			const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
			const ffmpeg = app.isPackaged ?
								path.resolve(process.resourcesPath,
											 `app.asar.unpacked/dist/bin/${ffmpegExe}`) :
								path.join(mainSourceDirectory, "..", "public", "bin", ffmpegExe);

			// Setup movie format specific options
			let opt = "";
			if(format === ".mp4") {

				let vf = "";
				if(width % 2 !== 0 || height % 2 !== 0) {

					const w2 = Math.floor(width/2)*2;
					const h2 = Math.floor(height/2)*2;
					vf = ` -vf "scale=${w2}:${h2}"`;
				}

				opt = " -movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov" + vf;
			}

			// Call ffmpeg to do the format conversion
			try {
				// eslint-disable-next-line sonarjs/os-command
				execSync(`"${ffmpeg}" -y -i ${webmFile}${opt} ${filename}`, {windowsHide: true});
				fs.unlinkSync(webmFile);
				// void fs.remove(webmFile);
				return {payload: filename};
			}
			catch(error) {
				return {error: `Cannot convert movie file. Error: ${(error as Error).message}`};
			}
		}
		try {
			fs.writeFileSync(filename, Buffer.from(buffer));
			return {payload: filename};
		}
		catch(error) {
			return {error: `Cannot save movie file "${filename}". Error: ${(error as Error).message}`};
		}
	}

	/**
	 * Channel handler for creating a STL file
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelSTL(params: CtrlParams): CtrlParams {

		const binary = params.binary as boolean ?? false;
		const {content} = params;
		if(!content) return {payload: ""};

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
			return {error: `Cannot save STL file "${filename}". Error: ${(error as Error).message}`};
		}
	}
}
