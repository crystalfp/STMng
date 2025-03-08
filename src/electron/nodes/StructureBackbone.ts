/**
 * Display primary structure of data that contains eventually chain data per atom.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2025-02-28
 */
import {NodeCore} from "../modules/NodeCore";
import {selectAtomsByKind, type SelectorType} from "../modules/SelectAtoms";
import {sendToClient} from "../modules/ToClient";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";


export class StructureBackbone extends NodeCore {

	private readonly id: string;
	private inputStructure: Structure | undefined;
	private readonly chains = new Set<string>();
	private enableStructureBackbone = false;
	private selectorKind: SelectorType = "label";
	private atomsSelector = "";
	private selectedChains: string[] = [];
	private radius = 0.5;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",    type: "invoke", callback: this.channelInit.bind(this)},
		{name: "compute", type: "send",   callback: this.channelCompute.bind(this)},
	];

	constructor(id: string) {
		super();
		this.id = id;
		this.setupChannels(id, this.channels);
	}

	override fromPreviousNode(data: Structure): void {

		this.inputStructure = data;
		if(!this.inputStructure) return;

		this.chains.clear();
		for(const atom of data.atoms) {
			this.chains.add(atom.chain);
		}
		sendToClient(this.id, "chains", {chains: this.chains.size > 1 ? [...this.chains] : []});

		this.computeBackbone();
	}

	// > Load/save status
	saveStatus(): string {
		const statusToSave = {
			enableStructureBackbone: this.enableStructureBackbone,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
			radius: this.radius,
		};
		return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

        this.enableStructureBackbone = params.enableStructureBackbone as boolean ?? false;
        this.selectorKind = params.selectorKind as SelectorType ?? "label";
        this.atomsSelector = params.atomsSelector as string ?? "";
		this.radius = params.radius as number ?? 0.5;
	}

	/**
	 * Compute backbone nodes and chain indices and send them to client
	 */
	private computeBackbone(): void {

		// Nothing to do
		if(!this.enableStructureBackbone ||
			!this.inputStructure ||
			(this.chains.size > 0 && this.selectedChains.length === 0) ||
		    (this.atomsSelector === "" && this.selectorKind !== "all")) {

			sendToClient(this.id, "positions", {coordinates: [], chainStart: []});
			return;
		}

		const {atoms} = this.inputStructure;

		const indices = selectAtomsByKind(this.inputStructure, this.selectorKind, this.atomsSelector);
		const indexSet = new Set(indices);
		const coordinates: number[] = [];
		const chainStart: number[] = [0];
		let nodeIndex = 0;

		const len = atoms.length;
		if(this.chains.size === 0) {
			for(let i=0; i < len; ++i) {

				if(indexSet.has(i)) {
					coordinates.push(atoms[i].position[0], atoms[i].position[1], atoms[i].position[2]);
					++nodeIndex;
				}
			}
			chainStart.push(nodeIndex);
		}
		else {
			for(const chain of this.selectedChains) {

				for(let i=0; i < len; ++i) {

					if(atoms[i].chain === chain && indexSet.has(i)) {
						coordinates.push(atoms[i].position[0], atoms[i].position[1], atoms[i].position[2]);
						++nodeIndex;
					}
				}
				chainStart.push(nodeIndex);
			}
		}
		sendToClient(this.id, "positions", {coordinates, chainStart});
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enableStructureBackbone: this.enableStructureBackbone,
			selectorKind: this.selectorKind,
			atomsSelector: this.atomsSelector,
			radius: this.radius,
		};
	}

	/**
	 * Channel handler for structure backbone parameters change
	 *
	 * @returns Computed symmetry
	 */
	private channelCompute(params: CtrlParams): void {

        this.enableStructureBackbone = params.enableStructureBackbone as boolean ?? false;
		this.selectedChains = params.selectedChains as string[] ?? [];
        this.selectorKind = params.selectorKind as SelectorType ?? "label";
        this.atomsSelector = params.atomsSelector as string ?? "";
		this.radius = params.radius as number ?? 0.5;

		this.computeBackbone();
	}
}
