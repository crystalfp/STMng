/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams} from "../../types";

export class Trajectories extends NodeCore {

	protected readonly name = "Trajectories";
	private structure: Structure | undefined;

	constructor(private readonly id: string) {
		super();
		console.log(`Instantiated ${this.name}`);
	}

	notifier(data: Structure): void {
		console.log(`NOTIFIED ${this.name}`);
		this.structure = data;
		if(!this.structure) return;
		console.log(`RUN ${this.name}`, this.structure.crystal.spaceGroup);
	}

	saveStatus(): string {
        const statusToSave = {
			showTrajectories: false,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		console.log("Loading", this.name, "with", params);
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "StructureWriterCtrl",
			graphic: "out",
			channels: ["1"]
		};
	}
}
