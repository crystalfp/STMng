/**
 * Read a structure.
 *
 * @packageDocumentation
 */

import {sb, type UiParams} from "@/services/Switchboard";
import {readFileStructure, readAuxFile, atomsTypeRename} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import {useConfigStore} from "@/stores/configStore";
import type {ReaderStructure, Structure, RenameInfo} from "@/types";

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

	/**
	 * Create the node
	 *
	 * @param id - ID of the Structure Reader node
	 */
	constructor(private readonly id: string) {

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

			// Change atoms types
			if(this.atomsTypes !== "" && this.atomsTypes !== this.atomsTypesPrevious) {

				this.changeAtomsType();
				this.atomsTypesPrevious = this.atomsTypes;
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
		readFileStructure(this.fileToRead, this.format, this.atomsTypes)
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
					const configStore = useConfigStore();
					configStore.control.reset = true;
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
	 */
	private changeAtomsType(): void {

		if(this.structures.length === 0) return;

		atomsTypeRename(this.atomsTypesPrevious.trim(), this.atomsTypes.trim())
			.then((renameInfoEncoded) => {

				const renameInfo = JSON.parse(renameInfoEncoded) as RenameInfo;

				if(renameInfo.error) throw Error(renameInfo.error);

				if(renameInfo.map.length === 0) return;

				const mapAtomZ = new Map<number, number>(renameInfo.map);
				for(const structure of this.structures) {

					for(const atom of structure.atoms) {
						const renamedAtomZ = mapAtomZ.get(atom.atomZ);
						if(renamedAtomZ === undefined) throw Error(`Invalid mapping for atomZ of ${atom.atomZ}`);
						atom.atomZ = renamedAtomZ;
					}
					structure.look = renameInfo.look;
				}
				sb.setData(this.id, this.structures[this.step-1]);
			})
			.catch((error: Error) => {
				showErrorNotification(`Error renaming atoms: ${error.message}`, "structureReader");
			});
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
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
