/**
 * Read a structure.
 *
 * @packageDocumentation
 */

import {sb, type UiParams} from "@/services/Switchboard";
import {readFileStructure} from "@/services/RoutesClient";
import {showErrorNotification, resetErrorNotification} from "@/services/ErrorNotification";
import {useConfigStore} from "@/stores/configStore";
import type {ReaderStructure, Structure} from "@/types";

export class StructureReader {

	private steps = 1;
	private step = 1;
	private running = false;
	private doLoad = false;
	private loopSteps = false;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private structures: Structure[] = [];
	private format = "";
	private atomsTypes = "";
	private inProgress = false;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Structure Reader node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			const requestedStep = params.step as number ?? 1;
			this.running    = params.running as boolean ?? false;
			this.doLoad     = params.doLoad as boolean ?? false;
    		this.loopSteps  = params.loopSteps as boolean ?? false;
    		const requestedFormat = params.format as string ?? "";
    		this.atomsTypes = params.atomsTypes as string ?? "";
    		this.inProgress = params.inProgress as boolean ?? false;

			if(requestedFormat !== this.format) {

				this.format = requestedFormat;
				this.step = 1;
				this.steps = 1;
				this.doLoad = false;
				this.running = false;
				sb.setUiParams(this.id, {
					filename: "",
					steps: 1,
					step: 1,
					running: false,
					doLoad: false,
				});
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
			}

			if(this.doLoad) {
				if(this.inProgress) return;
				this.doRead();
				this.doLoad = false;
				this.running = false;
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
				return;
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
		readFileStructure(this.format, this.atomsTypes)
			.then((structureRaw) => {

				resetErrorNotification("structureReader");

				if(!structureRaw) {
					this.inProgress = false;
					sb.setUiParams(this.id, {
						filename: "",
						steps: 1,
						step: 1,
						running: false,
						doLoad: false,
						inProgress: false,
					});

					return;
				}

				const structure = JSON.parse(structureRaw) as ReaderStructure;

				if(structure.error) throw Error(structure.error);

				sb.setUiParams(this.id, {
					filename: structure.filename,
					steps: structure.structures.length,
					step: 1,
					running: false,
					doLoad: false,
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
					filename: "",
					steps: 1,
					step: 1,
					running: false,
					doLoad: false,
					format: "",
					inProgress: false,
				});

				showErrorNotification(`Error reading structure: ${error.message}`, "structureReader");
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
