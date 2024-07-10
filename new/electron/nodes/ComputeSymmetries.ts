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

export class ComputeSymmetries extends NodeCore {

	private readonly name = "ComputeSymmetries";
	private structure: Structure | undefined;

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);
	}

	run() {
		if(!this.structure) return;
		console.log(`RUN ${this.name}`, this.structure.crystal.spaceGroup);
		this.structure.crystal.spaceGroup = "P -1"
		this.notify(this.structure!);
	}

	notifier(data: Structure): void {
		console.log(`NOTIFIED ${this.name}`);
		this.structure = data;
		this.run();
	}

	saveStatus(): string {
        const statusToSave = {
			showTrajectories: false,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: UiParams): void {
		console.log("Loading", this.name, "with", params);
	}

	getUiInfo(): UiInfo {

		return {id: this.id, ui: "SymmetriesCtrl", graphic: "none"};
	}
}
