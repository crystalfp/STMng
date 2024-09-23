/**
 * Extract the enclosing polyhedra.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-09
 */
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/SelectAtoms";
import {getAtomData} from "../modules/AtomData";
import {sendPolyhedraToClient} from "../modules/WindowsUtilities";
import type {Structure, UiInfo, CtrlParams, ChannelDefinition} from "@/types";

export class DrawPolyhedra extends NodeCore {

	private structure: Structure | undefined;
	private color = "#FFFFFF80";
	private labelKind: SelectorType = "symbol";
	private atomsSelector = "";
	private showPolyhedra = true;
	private colorByCenterAtom = true;
	private opacityByCenterAtom = 0.5;
	private readonly centerAtomsColor: string[] = [];

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "look",		type: "send", 	callback: this.channelLook.bind(this)},
		{name: "select",	type: "send", 	callback: this.channelSelect.bind(this)},
	];

	constructor(private readonly id: string) {
		super();
		this.setupChannels(this.id, this.channels);
	}

	override notifier(data: Structure): void {

		this.structure = data;
		if(!data || data.atoms.length === 0 || data.bonds.length === 0) {
			sendPolyhedraToClient(this.id, "vertices", [], []);
			return;
		}

		// Extract the polyhedrons vertices
		const islands = this.createVerticeLists();
		if(islands.length === 0) {
			sendPolyhedraToClient(this.id, "vertices", [], []);
			return;
		}

		sendPolyhedraToClient(this.id, "vertices", islands, this.centerAtomsColor);
	}

	saveStatus(): string {
        const statusToSave = {
			color: this.color,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			showPolyhedra: this.showPolyhedra,
			colorByCenterAtom: this.colorByCenterAtom,
			opacityByCenterAtom: this.opacityByCenterAtom
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.color = params.color as string ?? "#FFFFFF80";
		this.labelKind = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
		this.showPolyhedra = params.showPolyhedra as boolean ?? true;
		this.colorByCenterAtom = params.colorByCenterAtom as boolean ?? true;
		this.opacityByCenterAtom = params.opacityByCenterAtom as number ?? 0.5;
	}

	getUiInfo(): UiInfo {

		return {
			id: this.id,
			ui: "DrawPolyhedraCtrl",
			graphic: "out",
			channels: this.channels.map((channel) => channel.name)
		};
	}

	/**
	 * Compute vertices
	 *
	 * @returns List of lists of polyhedrons vertices
	 */
	private createVerticeLists(): number[][] {

		// Extract structure parts
		const {atoms, bonds} = this.structure!;

		// Sanity checks
		const natoms = atoms.length;
		if(natoms < 4) return [];
		if(bonds.length === 0) return [];

		// Select the polyhedra center atoms
		const centerIdx = selectAtomsByKind(this.structure!, this.labelKind, this.atomsSelector);

		// Create lists of connected atoms (island)
		const islands: number[][] = [];
		this.centerAtomsColor.length = 0;

		for(const idx of centerIdx) {
			const connected = [];
			for(const bond of bonds) {
				if(bond.from === idx) {
					connected.push(bond.to);
				}
				else if(bond.to === idx) {
					connected.push(bond.from);
				}
			}

			if(connected.length > 3) {
				islands.push(connected);

				if(this.colorByCenterAtom) {
					const {atomZ} = this.structure!.atoms[idx];
					this.centerAtomsColor.push(getAtomData(atomZ).color);
				}
			}
		}

		// Convert atom indexes to list of coordinates
		const out: number[][] = [];
		for(const island of islands) {

			const oneIsland: number[] = [];
			for(const atomIdx of island) {
				const {position} = atoms[atomIdx];
				oneIsland.push(position[0], position[1], position[2]);
			}
			out.push(oneIsland);
		}
		return out;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			color: this.color,
			labelKind: this.labelKind,
			atomsSelector: this.atomsSelector,
			showPolyhedra: this.showPolyhedra,
			colorByCenterAtom: this.colorByCenterAtom,
			opacityByCenterAtom: this.opacityByCenterAtom
		};
	}

	/**
	 * Channel handler for the change of visible characteristics
	 *
	 * @param params - Parameters from the client
	 */
	private channelLook(params: CtrlParams): void {

		this.color = params.color as string ?? "#FFFFFF80";
		this.showPolyhedra = params.showPolyhedra as boolean ?? true;
		this.colorByCenterAtom = params.colorByCenterAtom as boolean ?? true;
		this.opacityByCenterAtom = params.opacityByCenterAtom as number ?? 0.5;
	}

	/**
	 * Channel handler for the change of center atoms
	 *
	 * @param params - Parameters from the client
	 */
	private channelSelect(params: CtrlParams): void {

		this.labelKind = params.labelKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";

		// Extract the polyhedrons vertices and send to client
		if(!this.structure) return;
		const islands = this.createVerticeLists();

		sendPolyhedraToClient(this.id, "vertices", islands, this.centerAtomsColor);
	}
}
