/**
 * Interface to the Viewer3D component.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-08
 */
import {NodeCore} from "../modules/NodeCore";
import type {Viewer3DState, ChannelDefinition, CtrlParams} from "@/types";
import {askClient} from "../modules/WindowsUtilities";

export class Viewer3D extends NodeCore {

	private rawStatus = "";

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

	loadStatus(params: Viewer3DState): void {

		this.rawStatus = JSON.stringify(params);
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
