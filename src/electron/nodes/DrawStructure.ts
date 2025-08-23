/**
 * Transform the chemical structure in a set of 3D objects in the scene.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {NodeCore} from "../modules/NodeCore";
import {sendToClientForRendering} from "../modules/ToClient";
import {getAtomData} from "../modules/AtomData";
import type {Structure, CtrlParams, ChannelDefinition, AtomRenderInfo,
			 StructureRenderInfo} from "@/types";

export class DrawStructure extends NodeCore {

	private drawKind = "ball-and-stick";
	private drawQuality = 4;
	private drawRoughness = 0.5;
	private drawMetalness = 0.6;
	private labelKind = "symbol";
	private showAtoms = true;
	private showBonds = true;
	private showLabels = true;
	private shadedBonds = false;
	private showBondsStrengths = false;
	private atomColoring = "type";
	private monochromeColor = "#888888";
	private bondsRadiusMultiplier = 1;

	private readonly channels: ChannelDefinition[] = [
		{name: "init", type: "invoke", callback: this.channelInit.bind(this)},
		{name: "save", type: "send",   callback: this.channelSave.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
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
				rVdW: atomData.rVdW,
				bondStrength: atomData.bondStrength,
				bondCount: 0
			};
			renderInfo.atoms.push(atomInfo);
		}

		for(const bond of data.bonds) {
			renderInfo.bonds.push(bond);
			++renderInfo.atoms[bond.from].bondCount;
			++renderInfo.atoms[bond.to].bondCount;
		}

		sendToClientForRendering(this.id, "structure", renderInfo);
	}

	/**
	 * Collect node status
	 *
	 * @returns Collected status
	 */
	private collectStatus(): CtrlParams {
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
			showBondsStrengths: this.showBondsStrengths,
			atomColoring: this.atomColoring,
			monochromeColor: this.monochromeColor,
			bondsRadiusMultiplier: this.bondsRadiusMultiplier
		};
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = this.collectStatus();
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
		this.showBondsStrengths = params.showBondsStrengths as boolean ?? false;
        this.atomColoring = params.atomColoring as string ?? "type";
        this.monochromeColor = params.monochromeColor as string ?? "#888888";
		this.bondsRadiusMultiplier = params.bondsRadiusMultiplier as number ?? 1;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return this.collectStatus();
	}

	/**
	 * Channel handler for the change of parameters
	 *
	 * @param params - Parameters from the client
	 */
	private channelSave(params: CtrlParams): void {

		if(params.drawKind !== undefined)	   this.drawKind = params.drawKind as string;
		if(params.drawQuality !== undefined)   this.drawQuality = params.drawQuality as number;
		if(params.drawRoughness !== undefined) this.drawRoughness = params.drawRoughness as number;
		if(params.drawMetalness !== undefined) this.drawMetalness = params.drawMetalness as number;
		if(params.labelKind !== undefined)     this.labelKind = params.labelKind as string;
		if(params.showBonds !== undefined)     this.showBonds = params.showBonds as boolean;
		if(params.showAtoms !== undefined) 	   this.showAtoms = params.showAtoms as boolean;
		if(params.showLabels !== undefined)    this.showLabels = params.showLabels as boolean;
		if(params.shadedBonds !== undefined)   this.shadedBonds = params.shadedBonds as boolean;
		if(params.showBondsStrengths !== undefined) this.showBondsStrengths = params.showBondsStrengths as boolean;
		if(params.atomColoring !== undefined)  this.atomColoring = params.atomColoring as string;
		if(params.monochromeColor !== undefined) this.monochromeColor = params.monochromeColor as string;
		if(params.bondsRadiusMultiplier !== undefined) this.bondsRadiusMultiplier = params.bondsRadiusMultiplier as number;
	}
}
