/**
 * Transform the chemical structure in a set of 3D objects in the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition, AtomRenderInfo,
			 StructureRenderInfo} from "../../types";
import {sendToClientForRendering} from "../../../old/electron/modules/WindowsUtilities";
import {getAtomData} from "../modules/AtomData";

export class DrawStructure extends NodeCore {

	protected readonly name = "DrawStructure";
	private structure: Structure | undefined;
	private drawKind = "";
	private drawQuality = 4;
	private drawRoughness = 0.5;
	private drawMetalness = 0.6;
	private labelKind = "symbol";
	private showStructure = true;
	private showBonds = true;
	private showLabels = true;
	private shadedBonds = false;

	/* eslint-disable @typescript-eslint/unbound-method */
	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",      callback: this.channelInit},
	];
	/* eslint-enable @typescript-eslint/unbound-method */

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	notifier(data: Structure): void {

		if(!data) return;
		this.structure = data;
		console.log("----");
		console.log(JSON.stringify(this.structure.atoms[0], undefined, 2));

		const renderInfo: StructureRenderInfo = {atoms: [], bonds: []};

		for(const atom of data.atoms) {

			const atomData = getAtomData(atom.atomZ);

			const atomInfo: AtomRenderInfo = {
				symbol: atomData.symbol,
				label: atom.label,
				position: atom.position,
				color: atomData.color,
				rCov: atomData.rCov,
				rVdW: atomData.rVdW
			};
			renderInfo.atoms.push(atomInfo);
		}

		for(const bond of data.bonds) {
			renderInfo.bonds.push(bond);
		}

		sendToClientForRendering(this.id, "structure", renderInfo);
	}

	saveStatus(): string {
        const statusToSave = {
			drawKind: this.drawKind,
			drawQuality: this.drawQuality,
			drawRoughness: this.drawRoughness,
			drawMetalness: this.drawMetalness,
			labelKind: this.labelKind,
			showBonds: this.showBonds,
			showStructure: this.showStructure,
			showLabels: this.showLabels,
			shadedBonds: this.shadedBonds,
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.drawKind = params.drawKind as string ?? "ball-and-stick";
		this.drawQuality = params.drawQuality as number ?? 4;
		this.drawRoughness = params.drawRoughness as number ?? 0.5;
		this.drawMetalness = params.drawMetalness as number ?? 0.6;
		this.labelKind = params.labelKind as string ?? "symbol";
		this.showBonds = params.showBonds as boolean ?? true;
		this.showStructure = params.showStructure as boolean ?? true;
		this.showLabels = params.showLabels as boolean ?? true;
		this.shadedBonds = params.shadedBonds as boolean ?? true;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "DrawStructureCtrl",
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
			drawKind: this.drawKind,
			drawQuality: this.drawQuality,
			drawRoughness: this.drawRoughness,
			drawMetalness: this.drawMetalness,
			labelKind: this.labelKind,
			showBonds: this.showBonds,
			showStructure: this.showStructure,
			showLabels: this.showLabels,
			shadedBonds: this.shadedBonds,
		};
	}
}
