/**
 * Read a structure from file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import {sendAlertMessage} from "../modules/ToClient";
import {getAtomicNumber, getAtomicSymbol} from "../modules/AtomData";
import {EmptyStructure} from "../modules/EmptyStructure";
import type {Structure, CtrlParams, ChannelDefinition, ReaderOptions, ReaderImplementation} from "@/types";

// Import the readers

const formatsThatNeedsAtomTypes = new Set(["POSCAR", "CHGCAR", "LAMMPS",
										   "LAMMPStrj", "POSCAR + XDATCAR", "XDATCAR5",
										   "POSCAR + ENERGY"]);

export class StructureReader extends NodeCore {

	private loopSteps = false;
	private stepBackward = false;
	private step = 1;
	private speed = 1;

	/** Total number of steps in the structure loaded */
	private countSteps = 1;
	private format = "";
    private atomsTypes = "";
	private useBohr = true;
	private readHydrogen = false;
	private energyPerAtom = false;
	private fileToRead = "";
	private auxFileToRead = "";
	private reader: ReaderImplementation | undefined;

	/** Steps to add at each tick */
	private stepIncrement = 1;

	private structures: Structure[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",      callback: this.channelInit.bind(this)},
		{name: "read",		type: "invokeAsync", callback: this.channelRead.bind(this)},
		{name: "types",		type: "send",        callback: this.channelTypes.bind(this)},
		{name: "formats",	type: "send",        callback: this.channelFormats.bind(this)},
		{name: "bohr",		type: "send",        callback: this.channelUseBohr.bind(this)},
		{name: "hydrogen",	type: "send",        callback: this.channelReadHydrogen.bind(this)},
		{name: "per-atom",	type: "send",        callback: this.channelPerAtom.bind(this)},
		{name: "aux",		type: "invokeAsync", callback: this.channelAuxRead.bind(this)},
		{name: "step",		type: "invoke",      callback: this.channelStep.bind(this)},
		{name: "step-ctrl",	type: "send",      	 callback: this.channelStepCtrl.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);
		this.toNextNode(new EmptyStructure());
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			loopSteps: this.loopSteps,
			stepBackward: this.stepBackward,
			format: this.format,
      		atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
			readHydrogen: this.readHydrogen,
			energyPerAtom: this.energyPerAtom,
			stepIncrement: this.stepIncrement,
			speed: this.speed,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.loopSteps     = params.loopSteps as boolean ?? false;
		this.stepBackward  = params.stepBackward as boolean ?? false;
		this.format        = params.format as string ?? "";
    	this.atomsTypes    = params.atomsTypes as string ?? "";
    	this.useBohr       = params.useBohr as boolean ?? true;
        this.readHydrogen  = params.readHydrogen as boolean ?? false;
		this.energyPerAtom = params.energyPerAtom as boolean ?? false;
		this.stepIncrement = params.stepIncrement as number ?? 1;
        this.speed         = params.speed as number ?? 1;
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
			stepBackward: this.stepBackward,
			format: this.format,
			atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
			readHydrogen: this.readHydrogen,
			energyPerAtom: this.energyPerAtom,
			fileToRead: this.fileToRead,
			auxFileToRead: this.auxFileToRead,
			stepIncrement: this.stepIncrement,
			speed: this.speed
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
		try {

			switch(requestedFormat) {
				case "XYZ": {
						const {ReaderXYZ} = await import("../readers/ReadXYZ");
						this.reader = new ReaderXYZ();
					}
					break;
				case "XDATCAR5": {
						const {ReaderXDATCAR5} = await import("../readers/ReadXDATCAR5");
						this.reader = new ReaderXDATCAR5();
					}
					break;
				case "Shel-X": {
						const {ReaderSHELX} = await import("../readers/ReadSHELX");
						this.reader = new ReaderSHELX();
					}
					break;
				case "LAMMPS": {
						const {ReaderLAMMPS} = await import("../readers/ReadLAMMPS");
						this.reader = new ReaderLAMMPS();
					}
					break;
				case "LAMMPStrj": {
						const {ReaderLAMMPStrj} = await import("../readers/ReadLAMMPStrj");
						this.reader = new ReaderLAMMPStrj();
					}
					break;
				case "POSCAR":
				case "POSCAR + XDATCAR":
				case "POSCAR + ENERGY": {
						const {ReaderPOSCAR} = await import("../readers/ReadPOSCAR");
						this.reader = new ReaderPOSCAR();
					}
					break;
				case "CIF": {
						const {ReaderCIF} = await import("../readers/ReadCIF");
						this.reader = new ReaderCIF();
					}
					break;
				case "CEL": {
						const {ReaderCEL} = await import("../readers/ReadCEL");
						this.reader = new ReaderCEL();
					}
					break;
				case "CHGCAR": {
						const {ReaderCHGCAR} = await import("../readers/ReadCHGCAR");
						this.reader = new ReaderCHGCAR();
					}
					break;
				case "Gaussian Cube": {
						const {ReaderGAUSSIAN} = await import("../readers/ReadGAUSSIAN");
						this.reader = new ReaderGAUSSIAN();
					}
					break;
				case "PDB": {
						const {ReaderPDB} = await import("../readers/ReadPDB");
						this.reader = new ReaderPDB();
					}
					break;
				default: throw Error("Format not implemented");
			}
		}
		catch(error) {
			message = `Format "${requestedFormat}" error: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}
		this.useBohr = params.useBohr as boolean ?? true;
		this.atomsTypes = params.atomsTypes as string ?? "";

		let readerOptions: ReaderOptions;
		if(formatsThatNeedsAtomTypes.has(requestedFormat)) {

			const atomsTypesTrimmed = this.atomsTypes.trim();
			const atoms = atomsTypesTrimmed === "" ? [] : atomsTypesTrimmed.split(/\s+/);
			readerOptions = {atomsTypes: atoms};
		}
		else {
			readerOptions = {useBohr: this.useBohr, readHydrogen: this.readHydrogen};
		}

		// Read the file
		this.structures = await this.reader.readStructure(filename, readerOptions);

		// Set structure id
		for(let idx=0; idx < this.structures.length; ++idx) this.structures[idx].extra.step = idx+1;

		// Clean and check the structure list
		StructureReader.removeEmptyStructures(this.structures);
		if(StructureReader.checkStructures(this.structures)) {
			this.toNextNode(this.structures[0]);
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

		const updatedAtomsTypes = (params.atomsTypes as string ?? "").trim();
		this.changeAtomsType(updatedAtomsTypes);
		this.atomsTypes = updatedAtomsTypes;
	}

	/**
	 * Channel handler for the change of file format
	 *
	 * @param params - Parameters from the client
	 */
	private channelFormats(params: CtrlParams): void {

		this.format = params.format as string;
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
	 * Channel handler for the change of read hydrogen atoms
	 *
	 * @param params - Parameters from the client
	 */
	private channelReadHydrogen(params: CtrlParams): void {

		this.readHydrogen = params.readHydrogen as boolean;
		void this.changeReadHydrogen();
	}

	/**
	 * Channel handler for the change of energy per atom in file
	 *
	 * @param params - Parameters from the client
	 */
	private channelPerAtom(params: CtrlParams): void {

		this.energyPerAtom = params.energyPerAtom as boolean;
		// TBD
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

			switch(mainFormat) {
				case "POSCAR + XDATCAR": {
						const {readAuxXDATCAR} = await import("../readers/AuxXDATCAR");
						this.structures = await readAuxXDATCAR(filename, this.structures[0]);
					}
					break;
				case "POSCAR + ENERGY": {
						const {readAuxENERGY} = await import("../readers/AuxENERGY");
						this.structures = readAuxENERGY(filename, this.structures, this.energyPerAtom);
					}
					break;
				default:
					throw Error(`Format "${mainFormat}" has no auxiliary file`);
			}
		}
		catch(error) {
			const message = `Error reading auxiliary file: ${(error as Error).message}`;
			log.error(message);
			return {error: message};
		}

		// Send the updated structure down the pipeline
		this.toNextNode(this.structures[0]);

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

		if(requestedStep !== this.step) {

			if(requestedStep < 1 || requestedStep > this.structures.length) {
				const message = `Requested step ${requestedStep} is not in range 1-${this.structures.length}`;
				log.error(message);
				return {error: message};
			}

			this.step = requestedStep;

			// Send the updated structure down the pipeline
			this.toNextNode(this.structures[requestedStep-1]);
		}
		return {step: requestedStep};
	}

	/**
	 * Channel handler for the change of stepping related parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelStepCtrl(params: CtrlParams): void {

		this.loopSteps = params.loopSteps as boolean ?? false;
        this.stepIncrement = params.stepIncrement as number ?? 1;
        this.stepBackward = params.stepBackward as boolean ?? false;
        this.speed = params.speed as number ?? 1;
	}

	// > Helper functions
	/**
	 * Change the atoms type if this is changed on the user interface
	 *
	 * @param renamedAtomTypes - The space separated list of atom types to rename to
	 */
	private changeAtomsType(renamedAtomTypes: string): void {

		if(this.structures.length === 0) return;

		// Get the current atomic numbers in all structures
		const currentAtomsZ = new Set<number>();
		for(const structure of this.structures) {

			const {atoms} = structure;
			for(const atom of atoms) currentAtomsZ.add(atom.atomZ);
		}

		// Array of the renamed atom types
		let typesAfter: string[] = [];

		if(renamedAtomTypes === "") {

			for(let i=0; i < currentAtomsZ.size; ++i) {
				typesAfter.push(getAtomicSymbol(i+1));
			}
		}
		else {

			typesAfter = renamedAtomTypes.split(/\s+/);
			if(currentAtomsZ.size > typesAfter.length) {
				const missing = currentAtomsZ.size - typesAfter.length;
				const plural = missing === 1 ? "" : "s";
				sendAlertMessage(`Missing ${missing} atom symbol${plural} in the renamed list`, "structureReader");
				return;
			}
		}

		// Prepare the mapping from the current atomZ to the renamed atomZ
		const mapAtomZ = new Map<number, number>();
		let idx = 0;
		for(const from of currentAtomsZ) {

			const to = getAtomicNumber(typesAfter[idx]);
			if(to === 0) {
				sendAlertMessage(`Invalid symbol "${typesAfter[idx]}" in the renamed list`,
								 "structureReader");
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
		this.toNextNode(this.structures[this.step-1]);
	}

	/**
	 * Sanity check for the structures read
	 *
	 * @param structures - Structures read
	 * @returns True if the structures are valid
	 */
	private static checkStructures(structures: Structure[]): boolean {

		if(structures.length === 0) return false;
		for(const structure of structures) {
			if(structure.atoms.length === 0) return false;
		}
		return true;
	}

	/**
	 * Remove empty structures from the list of structures read.
	 * @remarks They are added mostly by CIF files.
	 *
	 * @param structures - List of structures to be pruned
	 */
	private static removeEmptyStructures(structures: Structure[]): void {

		const len = structures.length;
		if(len === 0) return;
		for(let idx = len-1; idx >= 0; --idx) {

			const structure = structures[idx];
			if(structure.atoms.length === 0) {
				structures.splice(idx, 1);
			}
		}
	}

	/**
	 * Change the unit between Angstrom and Bohr
	 */
	private changeBohrUnits(): void {

		if(!this.structures[0]) return;
		const {crystal, atoms, volume, extra} = this.structures[0];
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
			volume,
			extra
		};

		// Send the updated structure down the pipeline
		this.toNextNode(structure);
	}

	/**
	 * Read again a PDB file if should read or not hydrogens
	 */
	private async changeReadHydrogen(): Promise<void> {

		if(this.format !== "PDB") return;

		// Read the file
		this.structures = await this.reader!.readStructure(this.fileToRead, {readHydrogen: this.readHydrogen});

		// Set structure id
		for(let idx=0; idx < this.structures.length; ++idx) this.structures[idx].extra.step = idx+1;

		// Send the updated structure down the pipeline
		this.toNextNode(this.structures[this.step-1]);
	}
}
