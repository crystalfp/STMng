/**
 * Write structures to file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-09
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import {hasNoUnitCell} from "../modules/Helpers";
import {sendToClient} from "../modules/ToClient";
import type {Structure, CtrlParams, ChannelDefinition} from "@/types";

// Statically imported because it is used also in compute fingerprints to
// export selected structures
import {WriterPOSCAR} from "../writers/WritePOSCAR";

export class StructureWriter extends NodeCore {

	private structure: Structure | undefined;
	private format = "";			// Format of the save file
	private continuous = false;
	private outputFilename = "";	// Selected save file full path
	private captureData = false;
	private readonly capturedStructures: Structure[] = [];
	private hasNoUnitCell = false;

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

		if(!data?.atoms.length) {
			this.hasNoUnitCell = true;
			return;
		}
		if(this.captureData) this.capturedStructures.push(data);
		else this.structure = data;
		this.hasNoUnitCell = hasNoUnitCell(data.crystal.basis);
		sendToClient(this.id, "has-no-unit-cell", {hasNoUnitCell: this.hasNoUnitCell});
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
			hasNoUnitCell: this.hasNoUnitCell,
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
					// const {WriterPOSCAR} = await import("../writers/WritePOSCAR");
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
			const message = `Format "${this.format}" is not implemented.` +
							` Error: ${(error as Error).message}`;
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
