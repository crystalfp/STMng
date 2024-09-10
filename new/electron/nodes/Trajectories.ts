/**
 * Draw atom trajectories as lines or as position clouds.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "../../types";
import type {SelectorType} from "../modules/SelectAtoms";

export class Trajectories extends NodeCore {

	protected readonly name = "Trajectories";
	private structure: Structure | undefined;
	private showTrajectories = false;
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private maxDisplacement = 1;
	private showPositionClouds = false;
	private positionCloudsSideExp = 5;
	private positionCloudsGrow = 0.1;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "run",		type: "send",   callback: this.channelRun.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {
		console.log(`NOTIFIED ${this.name}`);
		this.structure = data;
		if(!this.structure) return;
		console.log(`RUN ${this.name}`, this.structure.crystal.spaceGroup);
	}

	saveStatus(): string {
        const statusToSave = {
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSideExp: this.positionCloudsSideExp,
			positionCloudsGrow: this.positionCloudsGrow,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.showTrajectories      = params.showTrajectories as boolean ?? false;
		this.labelKind             = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector         = params.atomsSelector as string ?? "";
		this.maxDisplacement       = params.maxDisplacement as number ?? 1;
		this.showPositionClouds    = params.showPositionClouds as boolean ?? false;
		this.positionCloudsSideExp = params.positionCloudsSideExp as number ?? 5;
    	this.positionCloudsGrow    = params.positionCloudsGrow as number ?? 0.1;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "TrajectoriesCtrl",
			graphic: "out",
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
			showTrajectories: this.showTrajectories,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			maxDisplacement: this.maxDisplacement,
			showPositionClouds: this.showPositionClouds,
			positionCloudsSideExp: this.positionCloudsSideExp,
			positionCloudsGrow: this.positionCloudsGrow,
		};
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelReset(): void {
		// this.accumulator.length = 0;
	}

	/**
	 * Channel handler for symmetry parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelRun(): void {
		// this.accumulator.length = 0;
	}
}
