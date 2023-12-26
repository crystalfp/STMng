
import {sb, type UiParams} from "@/services/Switchboard";
import {readStructure} from "@/services/RoutesClient";
import type {ReaderStructure, Structure} from "@/types";
import log from "electron-log";

export type StructureReaderData = Structure;

export class StructureReader {

	private steps = 1;
	private step = 1;
	private running = false;
	private loading = false;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private structures: Structure[] = [];

	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {

			const requestedStep = params.step as number ?? 1;
			this.running    = params.running as boolean ?? false;
			this.loading    = params.loading as boolean ?? false;

			if(requestedStep !== this.step) {
				this.step = requestedStep;
				sb.setData(this.id, this.structures[this.step-1]);
			}
			if(this.running) {

				if(this.intervalId === undefined && this.step < this.steps) {

					this.intervalId = setInterval(() => {
						++this.step;
						if(this.step === this.steps) {
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
			else {
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
				this.running = false;
			}

			if(this.loading) {

				this.doRead();
				this.loading = false;
				this.running = false;
        		if(this.intervalId !== undefined) {
					clearInterval(this.intervalId);
					this.intervalId = undefined;
				}
			}
		});
	}

	private doRead(): void {

		readStructure()
			.then((structureRaw) => {
				const structure = JSON.parse(structureRaw) as ReaderStructure;

				if(structure.error) throw Error(structure.error);

				sb.setUiParams(this.id, {
					filename: structure.filename,
					steps: structure.structures.length,
					step: 1,
					running: false,
					loading: false
				});
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
					loading: false
				});
				log.error("Error reading structure.", error.message);
			});
	}
}
