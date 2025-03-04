/**
 * Transform the chemical structure in a set of 3D objects in the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import {sendToClientForRendering} from "../modules/ToClient";
import {getAtomData} from "../modules/AtomData";
import type {Structure, CtrlParams, ChannelDefinition, AtomRenderInfo,
			 StructureRenderInfo} from "@/types";

export class DrawStructure extends NodeCore {

	private readonly id: string;
	private drawKind = "ball-and-stick";
	private drawQuality = 4;
	private drawRoughness = 0.5;
	private drawMetalness = 0.6;
	private labelKind = "symbol";
	private showAtoms = true;
	private showBonds = true;
	private showLabels = true;
	private shadedBonds = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit.bind(this)},
		{name: "save", type: "send",   callback: this.channelSave.bind(this)},
	];

	constructor(id: string) {
		super();
		this.id = id;
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		if(!data || data.atoms.length === 0) {

			sendToClientForRendering(this.id, "structure", {
				atoms: [],
				bonds: [],
				cell: {origin: [0, 0, 0], basis: [0, 0, 0, 0, 0, 0, 0, 0, 0]}
			});

			return;
		}

		const renderInfo: StructureRenderInfo = {
			atoms: [],
			bonds: [],
			cell: {origin: data.crystal.origin, basis: data.crystal.basis}
		};

		for(const atom of data.atoms) {

			const atomData = getAtomData(atom.atomZ);

			const atomInfo: AtomRenderInfo = {
				atomZ: atom.atomZ,
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

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			drawKind: this.drawKind,
			drawQuality: this.drawQuality,
			drawRoughness: this.drawRoughness,
			drawMetalness: this.drawMetalness,
			labelKind: this.labelKind,
			showBonds: this.showBonds,
			showAtoms: this.showAtoms,
			showLabels: this.showLabels,
			shadedBonds: this.shadedBonds,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.drawKind = params.drawKind as string ?? "ball-and-stick";
		this.drawQuality = params.drawQuality as number ?? 4;
		this.drawRoughness = params.drawRoughness as number ?? 0.5;
		this.drawMetalness = params.drawMetalness as number ?? 0.6;
		this.labelKind = params.labelKind as string ?? "symbol";
		this.showBonds = params.showBonds as boolean ?? true;
		this.showAtoms = params.showAtoms as boolean ?? true;
		this.showLabels = params.showLabels as boolean ?? true;
		this.shadedBonds = params.shadedBonds as boolean ?? false;
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
			showAtoms: this.showAtoms,
			showLabels: this.showLabels,
			shadedBonds: this.shadedBonds,
		};
	}

	/**
	 * Channel handler for the change of parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelSave(params: CtrlParams): void {

		if(params.drawKind)	     this.drawKind = params.drawKind as string;
		if(params.drawQuality)   this.drawQuality = params.drawQuality as number;
		if(params.drawRoughness) this.drawRoughness = params.drawRoughness as number;
		if(params.drawMetalness) this.drawMetalness = params.drawMetalness as number;
		if(params.labelKind)     this.labelKind = params.labelKind as string;
		if(params.showBonds)     this.showBonds = params.showBonds as boolean;
		if(params.showAtoms) 	 this.showAtoms = params.showAtoms as boolean;
		if(params.showLabels)    this.showLabels = params.showLabels as boolean;
		if(params.shadedBonds)   this.shadedBonds = params.shadedBonds as boolean;
	}
}
