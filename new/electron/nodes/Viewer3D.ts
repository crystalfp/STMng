/**
 * Interface to the Viewer3D component.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-08
 */
import {NodeCore} from "../modules/NodeCore";
import type {UiInfo, ViewerState, ChannelDefinition, CtrlParams} from "../../types";
import {askClient} from "../modules/WindowsUtilities";

export class Viewer3D extends NodeCore {

	protected readonly name = "Viewer3D";
	protected rawStatus = "{}";

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	async saveStatus(): Promise<string> {

		this.rawStatus = await askClient(this.id, "state");
        return this.rawStatus;
	}

	loadStatus(params: ViewerState): void {

		this.rawStatus = JSON.stringify(params);
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "Viewer3DCtrl",
			graphic: "in",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			rawStatus: this.rawStatus
		};
	}
}
