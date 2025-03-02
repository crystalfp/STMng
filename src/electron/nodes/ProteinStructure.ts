/**
 * Display primary structure of PDB data file.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {NodeCore} from "../modules/NodeCore";
import {sendToClient} from "../modules/ToClient";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";


export class ProteinStructure extends NodeCore {

	private inputStructure: Structure | undefined;
	private enableProteinStructure = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		// {name: "compute", type: "invoke", callback: this.channelCompute.bind(this)},
		// {name: "window",  type: "send",   callback: this.channelWindow.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.inputStructure = data;
		if(!this.inputStructure) return;

		if("residues" in data) {
			this.enableProteinStructure = true;
			sendToClient(this.id, "chains", {chains: data.residues!.chains});
		}
	}

	// > Load/save status
	saveStatus(): string {
		const statusToSave = {
			enableProteinStructure: this.enableProteinStructure,
		};
		return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.enableProteinStructure = params.enableProteinStructure as boolean ?? false;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enableProteinStructure: this.enableProteinStructure,
		};
	}
}
