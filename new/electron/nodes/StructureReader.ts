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
import {sendAlertMessage, sendToClient} from "../modules/WindowsUtilities";
import {getAtomicNumber} from "../modules/AtomData";

// Import the readers
import {ReaderXYZ} from "../readers/ReadXYZ";
import {ReaderSHELX} from "../readers/ReadSHELX";
import {ReaderPOSCAR} from "../readers/ReadPOSCAR";
import {ReaderCIF} from "../readers/ReadCIF";
import {ReaderCHGCAR} from "../readers/ReadCHGCAR";
import {ReaderLAMMPS} from "../readers/ReadLAMMPS";
import {ReaderLAMMPStrj} from "../readers/ReadLAMMPStrj";
import {ReaderGAUSSIAN} from "../readers/ReadGAUSSIAN";

import {readAuxXDATCAR} from "../readers/AuxXDATCAR";

const formatsThatNeedsAtomTypes = new Set(["POSCAR", "CHGCAR", "LAMMPS", "LAMMPStrj", "POSCAR + XDATCAR"]);

export class StructureReader extends NodeCore {

	protected readonly name = "StructureReader";
	private loopSteps = false;
	private running = false;
	private step = 1;
	private countSteps = 1;
	private format = "";
    private atomsTypes = "";
	private useBohr = true;
	private fileToRead = "";
	private auxFileToRead = "";
	private intervalId: ReturnType<typeof setInterval> | undefined;

	private structures: Structure[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",      callback: this.channelInit.bind(this)},
		{name: "read",		type: "invokeAsync", callback: this.channelRead.bind(this)},
		{name: "types",		type: "send",        callback: this.channelTypes.bind(this)},
		{name: "formats",	type: "send",        callback: this.channelFormats.bind(this)},
		{name: "bohr",		type: "send",        callback: this.channelUseBohr.bind(this)},
		{name: "aux",		type: "invokeAsync", callback: this.channelAuxRead.bind(this)},
		{name: "step",		type: "invoke",		 callback: this.channelStep.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
		this.notify({
			crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: ""
			},
			atoms: [],
			bonds: [],
			volume: []
		});
	}

	saveStatus(): string {
        const statusToSave = {
			loopSteps: this.loopSteps,
			format: this.format,
      		atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
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

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			loopSteps: this.loopSteps,
			format: this.format,
			atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
			fileToRead: this.fileToRead,
			auxFileToRead: this.auxFileToRead,
		};
	}

	/**
	 * Channel handler for read request
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private async channelRead(params: CtrlParams): Promise<CtrlParams> {

		const requestedFormat = params.format as string;
		const filename = params.fileToRead as string;
		this.fileToRead = filename;
		let message = "";
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
			message = `Format "${requestedFormat}" error: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}

		if(this.intervalId !== undefined) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}

		if(formatsThatNeedsAtomTypes.has(requestedFormat)) {

			const atomsTypesTrimmed = this.atomsTypes.trim();
			const atoms = atomsTypesTrimmed === "" ? [] : atomsTypesTrimmed.split(/ +/);
			this.structures = await reader.readStructure(filename, {atomsTypes: atoms});
			if(this.checkStructures(this.structures)) {
				this.notify(this.structures[0]);
				this.countSteps = this.structures.length;
				return {countSteps: this.countSteps};
			}

			message = `Invalid "${requestedFormat}" file content`;
			log.error(message);
			return {error: message};
		}

		this.structures = await reader.readStructure(filename, {useBohr: this.useBohr});
		if(this.checkStructures(this.structures)) {
			this.notify(this.structures[0]);
			this.countSteps = this.structures.length;
			return {countSteps: this.countSteps};
		}

		message = `Invalid "${requestedFormat}" file content`;
		log.error(message);
		return {error: message};
	}

	/**
	 * Channel handler for the change of atom types
	 *
	 * @param params - Parameters from the client
	 */
	private channelTypes(params: CtrlParams): void {

		const at = (params.atomsTypes as string).trim();
		this.changeAtomsType(at);
		this.atomsTypes = at;
	}

	/**
	 * Channel handler for the change of file format
	 *
	 * @param params - Parameters from the client
	 */
	private channelFormats(params: CtrlParams): void {

		this.format = params.format as string;
		if(this.intervalId !== undefined) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	/**
	 * Channel handler for the change of Bohr units
	 *
	 * @param params - Parameters from the client
	 */
	private channelUseBohr(params: CtrlParams): void {

		this.useBohr = params.useBohr as boolean;
		this.changeBohrUnits();
	}

	/**
	 * Channel handler for the auxiliary file read
	 *
	 * @param params - Parameters from the client
	 * @returns Params with the operation status
	 */
	private async channelAuxRead(params: CtrlParams): Promise<CtrlParams> {

		const mainFormat = params.format as string ?? "";
		const filename = params.auxFileToRead as string;
		this.auxFileToRead = filename;

		try {

			// If the number of formats increases, change this into a switch statement
			if(mainFormat === "POSCAR + XDATCAR") {
				this.structures = await readAuxXDATCAR(filename, this.structures[0]);
			}
			else throw Error(`Format "${mainFormat}" has no auxiliary file`);
		}
		catch(error) {
			const message = `Error reading auxiliary file: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}

		// Send the updated structure down the pipeline
		this.notify(this.structures[0]);

		this.countSteps = this.structures.length;
		return {countSteps: this.countSteps};
	}

	/**
	 * Channel handler for the step request
	 *
	 * @param params - Parameters from the client
	 * @returns Params with the operation status
	 */
	private channelStep(params: CtrlParams): CtrlParams {

		const requestedStep = params.step as number ?? 1;
		this.running = params.running as boolean ?? false;
		this.loopSteps = params.loopSteps as boolean ?? false;

		if(requestedStep !== this.step) {

			this.step = requestedStep;

			if(requestedStep < 1 || requestedStep > this.structures.length) {
				const message = `Requested step ${requestedStep} is not in range 1-${this.structures.length}`;
				log.error(message);
				return {error: message};
			}

			// Send the updated structure down the pipeline
			this.notify(this.structures[requestedStep-1]);
		}

		if(this.running) {

			if(this.intervalId === undefined && this.step < this.countSteps) {

				this.intervalId = setInterval(() => {
					++this.step;
					if(this.step > this.countSteps) {
						this.step = 1;
					}
					if(this.step === this.countSteps && !this.loopSteps) {
						clearInterval(this.intervalId);
						this.intervalId = undefined;
						this.running = false;
					}

					// Send the updated structure down the pipeline
					this.notify(this.structures[this.step-1]);

					sendToClient(this.id, "runningStep", {
						step: this.step,
						running: this.running,
					});

				}, 170);
			}
			return {running: this.running};
		}
		else if(this.intervalId !== undefined) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
			this.running = false;
		}

		return {running: this.running};
	}

	// > Helper functions
	/**
	 * Change the atoms type if this is changed on the user interface
	 *
	 * @param renamedAtomTypes - The space separated list of atom types to rename to
	 */
	private changeAtomsType(renamedAtomTypes: string): void {

		if(this.structures.length === 0 || renamedAtomTypes === "") return;

		// Array of the renamed atom types
		const typesAfter = renamedAtomTypes.split(/ +/);

		// Get the current atomic numbers
		const currentAtomsZ = new Set<number>();
		for(const atom of this.structures[0].atoms) currentAtomsZ.add(atom.atomZ);

		if(currentAtomsZ.size > typesAfter.length) {
			const missing = currentAtomsZ.size - typesAfter.length;
			const plural = missing === 1 ? "" : "s";
			sendAlertMessage(`Missing ${missing} atom symbol${plural} in the renamed list`, "structureReader");
			return;
		}

		// Prepare the mapping from the current atomZ to the renamed atomZ
		const mapAtomZ = new Map<number, number>();
		let idx = 0;
		for(const from of currentAtomsZ) {

			const to = getAtomicNumber(typesAfter[idx]);
			if(to === 0) {
				sendAlertMessage(`Invalid symbol "${typesAfter[idx]}" in the renamed list`, "structureReader");
				return;
			}
			mapAtomZ.set(from, to);
			++idx;
		}

		// Do the mapping
		for(const structure of this.structures) {

			for(const atom of structure.atoms) {

				const renamedAtomZ = mapAtomZ.get(atom.atomZ);
				if(renamedAtomZ === undefined) {

					sendAlertMessage(`Invalid mapping for atomZ of ${atom.atomZ}`, "structureReader");
					return;
				}
				atom.atomZ = renamedAtomZ;
			}
		}

		// Send the updated structure down the pipeline
		this.notify(this.structures[this.step-1]);
	}

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

	/**
	 * Change the unit between Angstrom and Bohr
	 */
	private changeBohrUnits(): void {

		if(!this.structures[0]) return;
		const {crystal, atoms, volume} = this.structures[0];
		if(!crystal) return;
		const {basis, origin, spaceGroup} = crystal;

		// Value from https://physics.nist.gov/cgi-bin/cuu/Value?bohrrada0
		const BOHR_TO_ANGSTROM = 0.529177210544;

		if(this.useBohr) {
			for(let i=0; i < 9; ++i) basis[i]  *= BOHR_TO_ANGSTROM;
			for(let i=0; i < 3; ++i) origin[i] *= BOHR_TO_ANGSTROM;
			for(const atom of atoms) {
				atom.position[0] *= BOHR_TO_ANGSTROM;
				atom.position[1] *= BOHR_TO_ANGSTROM;
				atom.position[2] *= BOHR_TO_ANGSTROM;
			}
		}
		else {
			for(let i=0; i < 9; ++i) basis[i]  /= BOHR_TO_ANGSTROM;
			for(let i=0; i < 3; ++i) origin[i] /= BOHR_TO_ANGSTROM;
			for(const atom of atoms) {
				atom.position[0] /= BOHR_TO_ANGSTROM;
				atom.position[1] /= BOHR_TO_ANGSTROM;
				atom.position[2] /= BOHR_TO_ANGSTROM;
			}
		}

		const structure: Structure = {
			crystal: {
				basis,
				origin,
				spaceGroup
			},
			atoms,
			bonds: [],
			volume
		};

		// Send the updated structure down the pipeline
		this.notify(structure);
	}
}
