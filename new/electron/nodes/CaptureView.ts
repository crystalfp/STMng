/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file CaptureView.ts
 * @since Mon Jul 08 2024
 */

import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, ViewerState} from "../../types";

export class CaptureView extends NodeCore {

	private readonly name = "CaptureView";

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);
	}

	run() {

	}

	notifier(_data: Structure): void {
		console.log("Never called");
	}

	saveStatus(): string {
        const statusToSave = {
			showTrajectories: false,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: ViewerState): void {
		console.log("Loading", this.name, "with", params);
	}

	getUiInfo(): UiInfo {

		return {id: this.id, ui: "CaptureViewCtrl", graphic: "in"};
	}
}
