/**
 * Interface to the Viewer3D component.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-08
 */
import {NodeCore} from "../modules/NodeCore";
import type {UiInfo, ViewerState} from "../../types";

export class Viewer3D extends NodeCore {

	protected readonly name = "Viewer3D";

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);
	}

	run() {

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
			ui: "Viewer3DCtrl",
			graphic: "in",
			channels: ["1"]
		};
	}
}
