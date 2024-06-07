/**
 * Read a structure.
 *
 * @packageDocumentation
 */

import {sb, type UiParams} from "@/services/Switchboard";
import {readFileStructure, readAuxFile} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import {useControlStore} from "@/stores/controlStore";
import {symbolToZ} from "@/services/AtomInfo";
import type {ReaderStructure, Structure} from "@/types";

export class StructureReader {

	private steps = 1;
	private step = 1;
	private running = false;
	private loopSteps = false;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private structures: Structure[] = [];
	private format = "";
	private atomsTypes = "";
	private atomsTypesPrevious = "";
	private inProgress = false;
	private fileToRead = "";
	private auxFileToRead = "";
	private auxInProgress = false;
	private useBohr = true;
	private useBohrPrevious = true;
	private static readonly BOHR_TO_ANGSTROM = 0.529177;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Structure Reader node
	 */
	constructor(private readonly id: string) {

		// Reset error notification
		resetErrorNotification("structureReader");

		sb.getUiParams(this.id, (params: UiParams) => {

			const requestedStep = params.step as number ?? 1;
			this.running    = params.running as boolean ?? false;
    		this.loopSteps  = params.loopSteps as boolean ?? false;
    		const requestedFormat = params.format as string ?? "";
    		this.atomsTypes = params.atomsTypes as string ?? "";
    		this.inProgress = params.inProgress as boolean ?? false;
    		this.fileToRead = params.fileToRead as string ?? "";
    		this.auxFileToRead = params.auxFileToRead as string ?? "";
    		this.auxInProgress = params.auxInProgress as boolean ?? false;
    		this.useBohr       = params.useBohr as boolean ?? true;

			// Change atoms types
			const at = this.atomsTypes.trim();
			if(at !== "" && at !== this.atomsTypesPrevious) {

				this.changeAtomsType(at);
				this.atomsTypesPrevious = at;
			}

			if(requestedFormat !== this.format) {

				this.format = requestedFormat;
				this.step = 1;
				this.steps = 1;
				this.running = false;
				sb.setUiParams(this.id, {
					fileToRead: "",
					steps: 1,
					step: 1,
					running: false,
				});
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
			}

			if(this.useBohr !== this.useBohrPrevious) {

				this.changeBohrUnits();
				this.useBohrPrevious = this.useBohr;
			}

			if(this.fileToRead) {
				if(this.inProgress) return;
				this.doRead();
				this.fileToRead = "";
				this.running = false;
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
				return;
			}

			if(this.auxFileToRead) {
				if(this.auxInProgress) return;
				this.doAuxFileRead();
				this.auxFileToRead = "";
			}

			if(requestedStep !== this.step) {
				this.step = requestedStep;
				sb.setData(this.id, this.structures[this.step-1]);
			}
			if(this.running) {

				if(this.intervalId === undefined && this.step < this.steps) {

					this.intervalId = setInterval(() => {
						++this.step;
						if(this.step > this.steps) {
							this.step = 1;
						}
						if(this.step === this.steps && !this.loopSteps) {
							clearInterval(this.intervalId);
							this.intervalId = undefined;
							this.running = false;
						}
						sb.setData(this.id, this.structures[this.step-1]);
						sb.setUiParams(this.id, {
							step: this.step,
							running: this.running,
						});

					}, 100);
				}
				sb.setUiParams(this.id, {
					step: this.step,
					running: this.running,
				});
			}
			else if(this.intervalId !== undefined) {
				clearInterval(this.intervalId);
				this.intervalId = undefined;
			}
		});
	}

	/**
	 * Start reading the structure file
	 */
	private doRead(): void {

		this.inProgress = true;
		sb.setUiParams(this.id, {inProgress: true});
		readFileStructure(this.fileToRead, this.format, this.atomsTypes, this.useBohr)
			.then((structureRaw) => {

				resetErrorNotification("structureReader");

				if(!structureRaw) {
					this.inProgress = false;
					sb.setUiParams(this.id, {
						fileToRead: "",
						steps: 1,
						step: 1,
						running: false,
						inProgress: false,
					});

					return;
				}

				const structure = JSON.parse(structureRaw) as ReaderStructure;

				if(structure.error) throw Error(structure.error);

				sb.setUiParams(this.id, {
					fileToRead: "",
					steps: structure.structures.length,
					step: 1,
					running: false,
					inProgress: false,
				});
				this.inProgress = false;
				this.step = 1;
				this.steps = structure.structures.length;
				this.structures = structure.structures;
				sb.setData(this.id, structure.structures[0]);

				// Try to reset the camera
				setTimeout(() => {
					const controlStore = useControlStore();
					controlStore.reset = true;
				}, 400);
			})
			.catch((error: Error) => {
				this.inProgress = false;
				sb.setUiParams(this.id, {
					fileToRead: "",
					steps: 1,
					step: 1,
					running: false,
					format: "",
					inProgress: false,
				});

				showErrorNotification(`Error reading structure: ${error.message}`, "structureReader");
			});
	}

	/**
	 * Change the unit between angstrom and Bohr
	 */
	private changeBohrUnits(): void {

		if(!this.structures[0]) return;
		const {crystal, atoms, volume} = this.structures[0];
		if(!crystal) return;
		const {basis, origin, spaceGroup} = crystal;

		if(this.useBohr) {
			for(let i=0; i < 9; ++i) basis[i]  *= StructureReader.BOHR_TO_ANGSTROM;
			for(let i=0; i < 3; ++i) origin[i] *= StructureReader.BOHR_TO_ANGSTROM;
			for(const atom of atoms) {
				atom.position[0] *= StructureReader.BOHR_TO_ANGSTROM;
				atom.position[1] *= StructureReader.BOHR_TO_ANGSTROM;
				atom.position[2] *= StructureReader.BOHR_TO_ANGSTROM;
			}
		}
		else {
			for(let i=0; i < 9; ++i) basis[i]  /= StructureReader.BOHR_TO_ANGSTROM;
			for(let i=0; i < 3; ++i) origin[i] /= StructureReader.BOHR_TO_ANGSTROM;
			for(const atom of atoms) {
				atom.position[0] /= StructureReader.BOHR_TO_ANGSTROM;
				atom.position[1] /= StructureReader.BOHR_TO_ANGSTROM;
				atom.position[2] /= StructureReader.BOHR_TO_ANGSTROM;
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

		sb.setData(this.id, structure);
	}

	/**
	 * Read the auxiliary file
	 */
	private doAuxFileRead(): void {
		this.auxInProgress = true;
		readAuxFile(this.auxFileToRead, this.format, this.structures[0])
			.then((structureRaw) => {

				resetErrorNotification("structureReader");

				if(!structureRaw) {
					this.auxInProgress = false;
					sb.setUiParams(this.id, {
						auxFileToRead: "",
						auxInProgress: false,
					});

					return;
				}

				const structure = JSON.parse(structureRaw) as ReaderStructure;

				if(structure.error) throw Error(structure.error);

				sb.setUiParams(this.id, {
					auxFileToRead: "",
					steps: structure.structures.length,
					step: 1,
					running: false,
					auxInProgress: false,
				});
				this.auxInProgress = false;
				this.step = 1;
				this.steps = structure.structures.length;
				this.structures = structure.structures;
				sb.setData(this.id, structure.structures[0]);
			})
			.catch((error: Error) => {
				this.auxInProgress = false;
				sb.setUiParams(this.id, {
					auxFileToRead: "",
					auxInProgress: false,
				});

				showErrorNotification(`Error reading auxiliary file: ${error.message}`, "structureReader");
			});
	}

	/**
	 * Change the atoms type if this is changed on the user interface
	 *
	 * @param renamedAtomTypes - The space separated list of atom types to rename to
	 */
	private changeAtomsType(renamedAtomTypes: string): void {

		if(this.structures.length === 0 || renamedAtomTypes === "") return;

		// Array of the renamed atom types
		const typesAfter = renamedAtomTypes.split(/ +/);

		// Mapping from the current atomZ to the renamed atomZ
		const mapAtomZ = new Map<number, number>();

		// Get the current atomic numbers
		const currentAtomsZ = new Set<number>();
		for(const atom of this.structures[0].atoms) currentAtomsZ.add(atom.atomZ);

		if(currentAtomsZ.size > typesAfter.length) {
			const missing = currentAtomsZ.size - typesAfter.length;
			const plural = missing === 1 ? "" : "s";
			showErrorNotification(`Missing ${missing} atom symbol${plural} in the renamed list`, "structureReader");
			return;
		}

		// Prepare the mapping
		let idx = 0;
		for(const from of currentAtomsZ) {

			const to = symbolToZ(typesAfter[idx]);
			if(to === 0) {
				showErrorNotification(`Invalid symbol "${typesAfter[idx]}" in the renamed list`, "structureReader");
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

					showErrorNotification(`Invalid mapping for atomZ of ${atom.atomZ}`, "structureReader");
					return;
				}
				atom.atomZ = renamedAtomZ;
			}
		}

		sb.setData(this.id, structuredClone(this.structures[this.step-1]));
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			loopSteps: this.loopSteps,
			step: 1,
			format: this.format,
      		atomsTypes: this.atomsTypes,
			useBohr: this.useBohr,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
