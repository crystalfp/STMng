
import {sb, type UiParams} from "@/services/Switchboard";
import {readFileStructure} from "@/services/RoutesClient";
import type {ReaderStructure, Structure} from "@/types";
import log from "electron-log";

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

	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			const requestedStep = params.step as number ?? 1;
			this.running    = params.running as boolean ?? false;
			this.doLoad     = params.doLoad as boolean ?? false;
    		this.loopSteps  = params.loopSteps as boolean ?? false;
    		const requestedFormat = params.format as string ?? "";
    		this.atomsTypes = params.atomsTypes as string ?? "";

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
					doLoad: false
				});
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
			}

			if(this.doLoad) {

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

					}, 500);
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

	private doRead(): void {

		readFileStructure(this.format, this.atomsTypes)
			.then((structureRaw) => {

				if(!structureRaw) return;

				const structure = JSON.parse(structureRaw) as ReaderStructure;

				if(structure.error) throw Error(structure.error);

				sb.setUiParams(this.id, {
					filename: structure.filename,
					steps: structure.structures.length,
					step: 1,
					running: false,
					doLoad: false
				});
				this.step = 1;
				this.steps = structure.structures.length;
				this.structures = structure.structures;
				sb.setData(this.id, structure.structures[0]);
			})
			.catch((error: Error) => {
				sb.setUiParams(this.id, {
					filename: error.message,
					steps: 1,
					step: 1,
					running: false,
					doLoad: false,
					format: ""
				});
				log.error("Error reading structure:", error.message);
			});
	}
}
