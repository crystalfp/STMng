/**
 * Save a screen capture as an image or a movie or
 * save the displayed structure as a STL file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-08
 */
import {dialog, BrowserWindow, type PrintToPDFOptions} from "electron";
import {writeFileSync} from "node:fs";
import {writeFile} from "node:fs/promises";
import path from "node:path";

import {Input, Output,
		BufferTarget, Conversion,
		WEBM,
		BufferSource,
		Mp4OutputFormat,
		OggOutputFormat,
		MkvOutputFormat,
		QUALITY_HIGH} from "mediabunny";

import {NodeCore} from "../modules/NodeCore";
import type {ChannelDefinition, CtrlParams} from "@/types";

export class CaptureView extends NodeCore {

	private readonly channels: ChannelDefinition[] = [
		{name: "snapshot",	  type: "invoke", 	   callback: this.channelSnapshot.bind(this)},
		{name: "snapshotPDF", type: "invokeAsync", callback: this.channelSnapshotPDF.bind(this)},
		{name: "movie",		  type: "invokeAsync", callback: this.channelMovie.bind(this)},
		{name: "stl",		  type: "invoke", 	   callback: this.channelSTL.bind(this)},
	];

	/**
	 * Create the node
	 */
	constructor() {
		super("SYSTEM");
		this.setupChannels("SYSTEM", this.channels);
	}

	// > Load/save status
	saveStatus(): string {
		return "";
	}

	loadStatus(): void {
		// No body necessary
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
		let format = params.format as string;
		if(!["png", "jpeg"].includes(format)) return {payload: ""};
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
			const data = dataURI.split(",");
			writeFileSync(filename, Buffer.from(data[1], "base64"));
			return {payload: filename};
		}
		catch(error) {
			return {error: `Cannot save image file "${filename}". Error: ${(error as Error).message}`};
		}
	}

	/**
	 * Channel handler for taking a screenshot in PDF format
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private async channelSnapshotPDF(params: CtrlParams): Promise<CtrlParams> {

		const dataURI = params.dataURI as string;
		if(!dataURI) return {payload: ""};
		const format = params.format as string;
		if(format !== "pdf") return {payload: ""};

		// Select the save file
		const filename = dialog.showSaveDialogSync({
			title: "Save snapshot file",
			defaultPath: `snapshot.${format}`,
			filters: [{name: format, extensions: [format]}]
		});
		if(!filename) return {payload: ""};

		// Open the browser in background
		const options: PrintToPDFOptions = {
			landscape: true,
			scale: 1.4,
			printBackground: false,
			pageSize: "A4" as "A4" | "Letter"
		};
		const windowPDF = new BrowserWindow({show : false});
		try {
			await windowPDF.loadURL(dataURI);
			const data = await windowPDF.webContents.printToPDF(options);
			await writeFile(filename, data);
			windowPDF.close();
			windowPDF.destroy();
		}
		catch(error) {
			windowPDF.close();
			windowPDF.destroy();
			return {error: `Cannot save PDF file "${filename}". Error: ${(error as Error).message}`};
		}

		return {payload: filename};
	}

	/**
	 * Channel handler for creating a movie
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private async channelMovie(params: CtrlParams): Promise<CtrlParams> {

		const buffer = params.buffer as ArrayBuffer;
		if(!buffer) return {payload: ""};

		let width = params.width as number;
		let height = params.height as number;

		const filename = dialog.showSaveDialogSync({
			title: "Save movie",
			filters: [
				{name: "WEBm", extensions: ["webm"]},
				{name: "mp4",  extensions: ["mp4"]},
				{name: "ogg",  extensions: ["ogg"]},
				{name: "mkv",  extensions: ["mkv"]},
			]
		});
		if(!filename) return {payload: ""};

		const format = path.extname(filename);
		if(format === ".webm") {
			try {
				writeFileSync(filename, Buffer.from(buffer));
				return {payload: filename};
			}
			catch(error) {
				return {error: `Cannot save movie file "${filename}". Error: ${(error as Error).message}`};
			}
		}

		const input = new Input({
			formats: [WEBM],
			source: new BufferSource(buffer),
		});

		let formatter;
		switch(format) {
			case ".mp4":
				formatter = new Mp4OutputFormat({fastStart: "in-memory"});
				break;
			case ".ogg":
				formatter = new OggOutputFormat();
				break;
			case ".mkv":
				formatter = new MkvOutputFormat();
				break;
			default:
				return {error: `Movie format "${format}" is not supported`};
		}

		if(width % 2 !== 0 || height % 2 !== 0) {

			width = Math.floor(width/2)*2;
			height = Math.floor(height/2)*2;
		}

		const output = new Output({
			format: formatter,
			target: new BufferTarget(),
		});

		try {
			const conversion = await Conversion.init({
				input,
				output,
				video: {
					width,
					height,
					fit: "contain",
					bitrate: QUALITY_HIGH
				},
			});

			await conversion.execute();
			if(!output.target.buffer) throw Error("Invalid output buffer");
			writeFileSync(filename, Buffer.from(output.target.buffer));
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
			if(binary) writeFileSync(filename, Buffer.from(content as ArrayBuffer));
			else       writeFileSync(filename, content as string, "utf8");
			return {payload: filename};
		}
		catch(error) {
			return {error: `Cannot save STL file "${filename}". Error: ${(error as Error).message}`};
		}
	}
}
