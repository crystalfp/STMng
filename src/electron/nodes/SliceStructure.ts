/**
 * Slice structure along a plane or along a sphere
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-04-09
 */
import {hasNoUnitCell} from "../modules/Helpers";
import {NodeCore} from "../modules/NodeCore";
import type {Structure, ChannelDefinition, CtrlParams} from "@/types";
import type {SelectorType} from "../modules/AtomsChooser";

export class SliceStructure extends NodeCore {

	private structure: Structure | undefined;
	private enableSlicer = false;
	private mode = "plane"; // "plane" or "sphere"
	private selectorKind = "symbol";
	private atomsSelector = "";

	private readonly channels: ChannelDefinition[] = [
		{name: "init",      type: "invoke", callback: this.channelInit.bind(this)},
		{name: "select",	type: "send", 	callback: this.channelSelect.bind(this)},
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

		if(!data || data.atoms.length === 0) return;
		this.structure = data;

		if(hasNoUnitCell(this.structure.crystal.basis) || !this.enableSlicer) {
			this.toNextNode(this.structure);
			return;
		}

		this.toNextNode(this.sliceStructure());
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			enableSlicer: this.enableSlicer,
			mode: this.mode,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {
		this.enableSlicer = params.enableSlicer as boolean ?? false;
		this.mode = params.mode as string ?? "plane";
        this.selectorKind = params.selectorKind as string ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
	}

	private sliceStructure(): Structure {
		return this.structure!; // TBD
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enableSlicer: this.enableSlicer,
			mode: this.mode,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
		};
	}

	/**
	 * Channel handler for the change of center atoms
	 *
	 * @param params - Parameters from the client
	 */
	private channelSelect(params: CtrlParams): void {

		this.selectorKind = params.selectorKind as SelectorType ?? "symbol";
		this.atomsSelector = params.atomsSelector as string ?? "";
	}
}
