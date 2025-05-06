/**
 * Write structures to file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

// import {WriterPOSCAR} from "../writers/WritePOSCAR";

export class StructureWriter extends NodeCore {

	private structure: Structure | undefined;
	private format = "";			// Format of the save file
	private continuous = false;
	private outputFilename = "";	// Selected save file full path
	private captureData = false;
	private readonly capturedStructures: Structure[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",			callback: this.channelInit.bind(this)},
		{name: "write",		type: "invokeAsync",	callback: this.channelWrite.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		if(!data || data.atoms.length === 0) return;
		if(this.captureData) this.capturedStructures.push(data);
		else this.structure = data;
	}

	// > Load/save status
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
	private async channelWrite(params: CtrlParams): Promise<CtrlParams> {

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
				case "XYZ": {
					const {WriterXYZ} = await import("../writers/WriteXYZ");
					writer = new WriterXYZ();
					break;
				}
				case "Shel-X": {
					const {WriterSHELX} = await import("../writers/WriteSHELX");
					writer = new WriterSHELX();
					break;
				}
				case "POSCAR": {
					const {WriterPOSCAR} = await import("../writers/WritePOSCAR");
					writer = new WriterPOSCAR();
					break;
				}
				case "CIF": {
					const {WriterCIF} = await import("../writers/WriteCIF");
					writer = new WriterCIF();
					break;
				}
				case "CHGCAR": {
					const {WriterCHGCAR} = await import("../writers/WriteCHGCAR");
					writer = new WriterCHGCAR();
					break;
				}
				case "PDB": {
					const {WriterPDB} = await import("../writers/WritePDB");
					writer = new WriterPDB();
					break;
				}
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
