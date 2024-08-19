/**
 * Find and apply symmetries to the input structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "../../types";

export class ComputeSymmetries extends NodeCore {

	protected readonly name = "ComputeSymmetries";
	private structure: Structure | undefined;
	private applyInputSymmetries = true;
	private enableFindSymmetries = true;
	private standardizeCell = true;
	private symprecStandardize = -5;
	private symprecDataset = -5;
	private fillUnitCell  = true;
	// private showSymmetriesDialog = false;
	// private inputStructure: Structure | undefined;
	private standardizeOnly = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {
		console.log(`NOTIFIED ${this.name}`);
		this.structure = data;
		if(!this.structure) return;
		this.notify(this.structure!);
	}

	saveStatus(): string {
        const statusToSave = {
	        applyInputSymmetries: this.applyInputSymmetries,
	        enableFindSymmetries: this.enableFindSymmetries,
	        standardizeCell: this.standardizeCell,
	        symprecStandardize: this.symprecStandardize,
	        symprecDataset: this.symprecDataset,
	        fillUnitCell: this.fillUnitCell,
	        standardizeOnly: this.standardizeOnly,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
        this.applyInputSymmetries = params.applyInputSymmetries as boolean ?? true;
        this.enableFindSymmetries = params.enableFindSymmetries as boolean ?? true;
        this.standardizeCell = params.standardizeCell as boolean ?? true;
        this.symprecStandardize = params.symprecStandardize as number ?? -1;
        this.symprecDataset = params.symprecDataset as number ?? -1;
        this.fillUnitCell  = params.fillUnitCell as boolean ?? true;
        this.standardizeOnly = params.standardizeOnly as boolean ?? false;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "ComputeSymmetriesCtrl",
			graphic: "none",
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
			applyInputSymmetries: this.applyInputSymmetries,
			enableFindSymmetries: this.enableFindSymmetries,
			standardizeCell: this.standardizeCell,
			symprecStandardize: this.symprecStandardize,
			symprecDataset: this.symprecDataset,
			fillUnitCell: this.fillUnitCell,
			standardizeOnly: this.standardizeOnly,
		};
	}
}
