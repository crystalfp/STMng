/**
 * Read a structure from file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams} from "../../types";

export class StructureReader extends NodeCore {

	protected readonly name = "StructureReader";
	private loopSteps = false;
	private step = 1;
	private format = "";
    private atomsTypes = "";
	private useBohr = false;

	private structures: Structure[] = [];

	private readonly channels = [
		{name: ":1", callback: this.channel1}
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

	private channel1(): CtrlParams {

		return {
			loopSteps: this.loopSteps,
			format: this.format,
			atomsTypes: this.atomsTypes,
			useBohr: this.useBohr
		};
	}
}
