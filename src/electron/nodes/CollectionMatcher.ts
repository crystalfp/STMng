/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-11
 */
import {NodeCore} from "../modules/NodeCore";
import type {ChannelDefinition, CtrlParams, FingerprintingParameters, Structure} from "@/types";
import {sendToClient} from "../modules/ToClient";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import {CollectionDb} from "../modules/CollectionDb";
import {publicDirPath} from "../modules/GetPublicPath";

export class CollectionMatcher extends NodeCore {

	private structure: Structure | undefined;
	private readonly collection = new CollectionDb();

	// Mirror of the UI reactive state
	private state = {
		enabled: false,
		noThreshold: false,
		threshold: 0.01,
		numberMatches: 1
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "enable",	type: "invoke", callback: this.channelEnable.bind(this)},
		{name: "state",		type: "send",	callback: this.channelState.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		this.setupChannels(id, this.channels);

		const db = publicDirPath("structure-collection").replaceAll("\\", "/");

		this.collection.loadFingerprints(db);
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.enabled = params.enabled as boolean ?? false;
        this.state.noThreshold = params.noThreshold as boolean ?? false;
        this.state.numberMatches = params.numberMatches as number ?? 1;
        this.state.threshold = params.threshold as number ?? 0.01;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Input structure
	override fromPreviousNode(data: Structure): void {

		this.structure = data;

		this.findSimilar();
	}

	private computeFingerprint(structure: Structure): Float64Array {

		const {atoms, crystal} = structure;

		const params: FingerprintingParameters = {

			method: 0,
			areNanoclusters: false,
			cutoffDistance: 10,
			binSize: 0.05,
			peakWidth: 0.02,
			processParallelism: false
		};
		const natoms = atoms.length;
		const basis: Float64Array = new Float64Array(9);
		const positions: Float64Array = new Float64Array(natoms*3);
		const atomsZ: Int32Array = new Int32Array(natoms);

		for(let i=0; i < 9; ++i) {
			basis[i] = crystal.basis[i];
		}
		for(let i=0, j=0; i < natoms; ++i) {
			atomsZ[i] = 1;
			positions[j++] = atoms[i].position[0];
			positions[j++] = atoms[i].position[1];
			positions[j++] = atoms[i].position[2];
		}

		const result = fingerprintingOganovValle(params, basis, natoms, positions, atomsZ);

		return result.fingerprint;
	}

	private findSimilar(): void {

		// Nothing to do
		if(!this.state.enabled || !this.structure?.atoms.length) {
			sendToClient(this.id, "load", {
				titles: [],
				ids: [],
				distances: []
			});
			return;
		}

		// Compute the input structure fingerprint
		const fp = this.computeFingerprint(this.structure);

		// Find similar
		const threshold = this.state.noThreshold ? 0 : this.state.threshold;
		const results = this.collection.getNearestStructures(fp, this.state.numberMatches, threshold);

		// Prepare the data for the client
		const titles: string[] = [];
		const ids: string[] = [];
		const distances: number[] = [];

		for(const result of results) {
			titles.push(result.title);
			ids.push(result.id);
			distances.push(result.distance!);
		}
		sendToClient(this.id, "load", {
			titles,
			ids,
			distances
		});
	}


	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			enabled: this.state.enabled,
        	noThreshold: this.state.noThreshold,
        	numberMatches: this.state.numberMatches,
        	threshold: this.state.threshold
		};
	}

	/**
	 * Channel handler for enabling the collection matcher
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelEnable(params: CtrlParams): CtrlParams {

		this.state.enabled = params.enabled as boolean ?? false;

		// TBD
		return {results: ""};
	}

	/**
	 * Channel handler for saving the UI status
	 */
	private channelState(params: CtrlParams): void {

		this.initializeState(params);

		this.findSimilar();
	}
}
