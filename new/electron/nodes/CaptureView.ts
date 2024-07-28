/**
 * Save a screen capture as an image or a movie or save the displayed structure
 * as a STL file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-08
 */
import {NodeCore} from "../modules/NodeCore";
import type {UiInfo, ViewerState} from "../../types";

export class CaptureView extends NodeCore {

	protected readonly name = "CaptureView";

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);
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

		return {
			id: this.id,
			ui: "CaptureViewCtrl",
			graphic: "none",
			channels: ["1"]
		};
	}
}
