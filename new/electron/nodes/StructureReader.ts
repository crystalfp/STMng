/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file ComputeSymmetries.ts
 * @since Fri Jul 05 2024
 */

import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, UiParams} from "../../types";

export class StructureReader extends NodeCore {

	private readonly name = "StructureReader";
	private loopSteps = false;
	private step = 1;
	private format = "";
    private atomsTypes = "";
	private useBohr = false;

	private structures: Structure[] = [];

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);

		// Create the channel to the UI name ${id}:${direction}:${specifier}
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

	notifier(_data: Structure): void {
		console.log("Never called");
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

	loadStatus(params: UiParams): void {
		this.loopSteps  = params.loopSteps as boolean ?? false;
		this.format     = params.format as string ?? "";
    	this.atomsTypes = params.atomsTypes as string ?? "";
    	this.useBohr    = params.useBohr as boolean ?? true;
	}

	getUiInfo(): UiInfo {

		return {id: this.id, ui: "StructureReaderCtrl", graphic: "none"};
	}
}
