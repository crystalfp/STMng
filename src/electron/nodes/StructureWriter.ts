/**
 * Write structures to file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";
import log from "electron-log";

import {WriterXYZ} from "../writers/WriteXYZ";
import {WriterPOSCAR} from "../writers/WritePOSCAR";
import {WriterSHELX} from "../writers/WriteSHELX";
import {WriterCHGCAR} from "../writers/WriteCHGCAR";
import {WriterCIF} from "../writers/WriteCIF";

export class StructureWriter extends NodeCore {

	private structure: Structure | undefined;
	private format = "";			// Format of the save file
	private continuous = false;
	private outputFilename = "";		// Selected save file full path
	private captureData = false;
	private readonly capturedStructures: Structure[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",	callback: this.channelInit.bind(this)},
		{name: "write",		type: "invoke",	callback: this.channelWrite.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

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

    	this.format = params.format as string ?? "";
    	this.continuous = params.continuous as boolean ?? false;
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
	 * Channel handler for capture and write structures
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelWrite(params: CtrlParams): CtrlParams {

		this.continuous = params.continuous as boolean ?? false;
		const running = params.inProgress as boolean ?? false;
		this.format = params.format as string ?? "";
		this.outputFilename = params.filename as string ?? "";

		// If continuous capture requested
		if(this.continuous && running) {
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

		const structures: Structure[] = this.continuous ? this.capturedStructures : [this.structure!];
		this.captureData = false;

		const sts = writer.writeStructure(this.outputFilename, structures);
		if(sts.error) {
			const message = `Error writing "${this.outputFilename}" file` +
							` in "${this.format}" format. Error: ${sts.error as string}`;
			log.error(message);
			return {error: message};
		}
		return sts;
	}
}
