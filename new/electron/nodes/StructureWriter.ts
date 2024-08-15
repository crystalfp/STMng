/**
 * Write structures to file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "../../types";
import {dialog} from "electron";
import log from "electron-log";

import {WriterXYZ} from "../writers/WriteXYZ";
import {WriterPOSCAR} from "../writers/WritePOSCAR";
import {WriterSHELX} from "../writers/WriteSHELX";
import {WriterCHGCAR} from "../writers/WriteCHGCAR";
import {WriterCIF} from "../writers/WriteCIF";

export class StructureWriter extends NodeCore {

	protected readonly name = "StructureWriter";
	private structure: Structure | undefined;
	private format = "";			// Format of the save file
	private continuous = false;
	private outputFilename = "";		// Selected save file full path
	private captureData = false;
	private readonly capturedStructures: Structure[] = [];

	/* eslint-disable @typescript-eslint/unbound-method */
	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",		callback: this.channelInit},
		{name: "select",	type: "invoke",  	callback: this.channelSelect},
		{name: "write",		type: "invoke",  	callback: this.channelWrite},
	];
	/* eslint-enable @typescript-eslint/unbound-method */

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		if(!data || data.atoms.length === 0) return;
		if(this.captureData) this.capturedStructures.push(data);
		else this.structure = data;
	}

	saveStatus(): string {
        const statusToSave = {
			format: this.format,
			continuous: this.continuous,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

    	this.format = params.format as string ?? ""; //
    	this.continuous = params.continuous as boolean ?? false; //
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "StructureWriterCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			format: this.format,
			continuous: this.continuous,
			outputFilename: this.outputFilename,
		};
	}

	/**
	 * Channel handler for save file selection
	 *
	 * @returns Parameters with the filename selected
	 */
	private channelSelect(params: CtrlParams): CtrlParams {

		// Save the format
		this.format = params.format as string ?? "";
		if(!this.format) return {filename: ""};

		// Set filter
		let filters;
		switch(this.format) {
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

		this.outputFilename = file ? file.replaceAll("\\", "/") : "";
		return {filename: this.outputFilename};
	}

	/**
	 * Channel handler for capture and write structures
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelWrite(params: CtrlParams): CtrlParams {

		const continuous = params.continuous as boolean ?? false;
		const running = params.inProgress as boolean ?? false;

		// If continuous capture requested
		if(continuous && running) {
			this.capturedStructures.length = 0;
			this.capturedStructures.push(this.structure!);
			this.captureData = true;
			return {payload: "Started"};
		}
		if(!this.format || !this.outputFilename) return {payload: ""};

		let writer;
		try {

			switch(this.format) {
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
		catch(error) {
			const message = `Format "${this.format}" is not implemented. Error: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}

		const structures: Structure[] = continuous ? this.capturedStructures : [this.structure!];
		this.captureData = false;

		const sts = writer.writeStructure(this.outputFilename, structures);
		if(sts.error) {
			const message = `Error writing "${this.outputFilename}" file` +
							`in "${this.format}" format. Error: ${sts.error}`;
			log.error(message);
			return {error: message};
		}
		return sts;
	}
}
