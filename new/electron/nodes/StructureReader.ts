/**
 * Read a structure from file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "../../types";
// Import the readers
import {ReaderXYZ} from "../readers/ReadXYZ";
import {ReaderSHELX} from "../readers/ReadSHELX";
import {ReaderPOSCAR} from "../readers/ReadPOSCAR";
import {ReaderCIF} from "../readers/ReadCIF";
import {ReaderCHGCAR} from "../readers/ReadCHGCAR";
import {ReaderLAMMPS} from "../readers/ReadLAMMPS";
import {ReaderLAMMPStrj} from "../readers/ReadLAMMPStrj";
import {ReaderGAUSSIAN} from "../readers/ReadGAUSSIAN";

export class StructureReader extends NodeCore {

	protected readonly name = "StructureReader";
	private loopSteps = false;
	private step = 1;
	private format = "";
    private atomsTypes = "";
	private useBohr = false;
	private fileToRead = "";
	private filesSelectedFull = "{}";

	private structures: Structure[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit},
		{name: "read", type: "invoke", callback: this.channelRead},
		// {name: "3", type: "send",   callback: this.channel2},
	];

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);

		this.setupChannels(this.id, this.channels);
	}

	run(): void {
		console.log(`RUN ${this.name}`);

		this.structures = [{
				crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: "P1"
			},
			atoms: [],
			bonds: [],
			volume: []
		}];
		this.step = 1;
		this.notify(this.structures[this.step-1]);
	}

	saveStatus(): string {
        const statusToSave = {
			loopSteps: this.loopSteps,
			format: this.format,
      		atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.loopSteps  = params.loopSteps as boolean ?? false;
		this.format     = params.format as string ?? "";
    	this.atomsTypes = params.atomsTypes as string ?? "";
    	this.useBohr    = params.useBohr as boolean ?? true;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "StructureReaderCtrl",
			graphic: "none",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	private channelInit(): CtrlParams {

		return {
			loopSteps: this.loopSteps,
			format: this.format,
			atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
			fileToRead: this.fileToRead,
			filesSelectedFull: this.filesSelectedFull,
		};
	}

	// private channel2(params: CtrlParams): void {
	// 	console.log(params);
	// }

	/**
	* Sanity check for the structures read
	*
	* @param structures - Structures read
	* @returns True if the structures are valid
	*/
	private checkStructures(structures: Structure[]): boolean {

		if(structures.length === 0) return false;
		for(const structure of structures) {
			if(structure.atoms.length === 0) return false;
		}
		return true;
	};

	private async channelRead(params: CtrlParams): Promise<CtrlParams> {

		const requestedFormat = params.format;
		let reader;
		try {

			switch(requestedFormat) {
				case "XYZ":
					reader = new ReaderXYZ();
					break;
				case "Shel-X":
					reader = new ReaderSHELX();
					break;
				case "LAMMPS":
					reader = new ReaderLAMMPS();
					break;
				case "LAMMPStrj":
					reader = new ReaderLAMMPStrj();
					break;
				case "POSCAR":
				case "POSCAR + XDATCAR":
					reader = new ReaderPOSCAR();
					break;
				case "CIF":
					reader = new ReaderCIF();
					break;
				case "CHGCAR":
					reader = new ReaderCHGCAR();
					break;
				case "Gaussian Cube":
					reader = new ReaderGAUSSIAN();
					break;
				default: throw Error("Format not implemented");
			}
		}
		catch(error) {
			const message = `Format "${requestedFormat}" error: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}

		if(requestedFormat === "POSCAR" ||
		requestedFormat === "POSCAR + XDATCAR" ||
		requestedFormat === "CHGCAR" ||
		requestedFormat === "LAMMPS" ||
		requestedFormat === "LAMMPStrj") {
			const atomsTypesTrimmed = this.atomsTypes.trim();
			const atoms = atomsTypesTrimmed === "" ? [] : atomsTypesTrimmed.split(/ +/);
			this.structures = await reader.readStructure(this.fileToRead, {atomsTypes: atoms});
			if(this.checkStructures(this.structures)) {
				this.notify(this.structures[0]);
				return {
					countSteps: this.structures.length,
				}
			}
			else {
				const message = `Invalid "${requestedFormat}" file content`;
				log.error(message);
				return {error: message};
			}
		}

		this.structures = await reader.readStructure(this.fileToRead, {useBohr: this.useBohr});
		if(this.checkStructures(this.structures)) {
			this.notify(this.structures[0]);
			return {
				countSteps: this.structures.length,
			}
		}
		else {
			const message = `Invalid "${requestedFormat}" file content`;
			log.error(message);
			return {error: message};
		}
	}
}
