/**
 * Save a screen capture as an image or a movie or
 * save the displayed structure as a STL file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-08
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {dialog, BrowserWindow, type PrintToPDFOptions} from "electron";
import {writeFileSync} from "node:fs";
import path from "node:path";
import {writeFile} from "node:fs/promises";
import {NodeCore} from "../modules/NodeCore";
import type {ChannelDefinition, CtrlParams} from "@/types";

export class CaptureView extends NodeCore {

	private readonly channels: ChannelDefinition[] = [
		{name: "snapshot",	  type: "invoke", 	   callback: this.channelSnapshot.bind(this)},
		{name: "snapshotPDF", type: "invokeAsync", callback: this.channelSnapshotPDF.bind(this)},
		{name: "movie-start", type: "invoke",	   callback: this.channelMovieStart.bind(this)},
		{name: "movie",		  type: "invoke", 	   callback: this.channelMovie.bind(this)},
		{name: "stl",		  type: "invoke", 	   callback: this.channelSTL.bind(this)},
	];

	/**
	 * Create the node
	 */
	constructor() {
		super("SYSTEM");
		this.setupChannels("SYSTEM", this.channels);
	}

	description(): string {
		return "Capture the screen content as a snapshot in an image or PDF file or the 3D objects as a STL model. Captures also a sequence of screens as a movie file";
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
			pageSize: "A4"
		};
		const windowPDF = new BrowserWindow({show: false});
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
	 * Channel handler for selecting the output movie file
	 *
	 * @returns Params with the operation status
	 */
	private channelMovieStart(): CtrlParams {

		const filename = dialog.showSaveDialogSync({
			title: "Save movie",
			filters: [
				{name: "WEBm", extensions: ["webm"]},
				{name: "mp4",  extensions: ["mp4"]},
				{name: "mkv",  extensions: ["mkv"]},
			]
		});
		if(filename) return {filename, extension: path.extname(filename)};
		return {filename: "", extension: ""};
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
		const filename = params.filename as string;
		if(!filename) return {payload: ""};

		try {
			writeFileSync(filename, Buffer.from(buffer));
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
