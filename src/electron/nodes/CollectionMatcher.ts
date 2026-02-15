/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-11
 */
import {NodeCore} from "../modules/NodeCore";
import {sendToClient} from "../modules/ToClient";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import {collectionLoadFingerprints, collectionGetNearestStructures,
		collectionGetStructure} from "../modules/CollectionDb";
import {publicDirPath} from "../modules/GetPublicPath";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import {getAtomData} from "../modules/AtomData";
import type {ChannelDefinition, CtrlParams, FingerprintingParameters,
			 PrototypeAtomsData, Structure} from "@/types";

export class CollectionMatcher extends NodeCore {

	private structure: Structure | undefined;

	// Mirror of the UI reactive state
	private state = {
		enabled: false,
		noThreshold: false,
		threshold: 0.01,
		numberMatches: 1
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "state",		type: "send",	callback: this.channelState.bind(this)},
		{name: "show",		type: "invoke", callback: this.channelShow.bind(this)},
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

		collectionLoadFingerprints(db);
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

	// > Computation
	/**
	 * Compute fingerprints
	 *
	 * @param structure - Input structure for which fingerprint should be computed
	 * @returns The fingerprint
	 */
	private computeFingerprint(structure: Structure): Float64Array {

		const {atoms, crystal} = structure;

		// Should be the same values set in the preprocessor
		const params: FingerprintingParameters = {

			method: 0,
			areNanoclusters: false,
			cutoffDistance: 10,
			binSize: 0.03,
			peakWidth: 0.01,
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

	/**
	 * Find similar structures from the collection
	 */
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
		const results = collectionGetNearestStructures(fp, this.state.numberMatches, threshold);

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
	 * Channel handler for saving the UI status and start computation
	 */
	private channelState(params: CtrlParams): void {

		this.initializeState(params);

		this.findSimilar();
	}

	/**
	 * Channel handler for display the collection structure matched
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelShow(params: CtrlParams): CtrlParams {

		const id = params.id as string;
		if(!id) return {result: "Empty file ID"};

		const structure = collectionGetStructure(id);
		if(structure === undefined) {
			const message = `File for ID "${id}" not found`;
			return {error: message};
		}

		const out: PrototypeAtomsData = {
			positions: [],
			labels: [],
			radius: [],
			color: [],
		};

		for(const atom of structure.atoms) {

			out.positions.push(...atom.position);
			out.labels.push(atom.label);

			const ad = getAtomData(atom.atomZ);
			out.radius.push(ad.rCov);
			out.color.push(ad.color);
		}

		const dataForClient: CtrlParams = {
			matrix: structure.crystal.basis,
			atoms: JSON.stringify(out)
		};

		createOrUpdateSecondaryWindow({
			routerPath: "/prototype",
			width: 1400,
			height: 900,
			title: "Collection structure",
			data: dataForClient
		});

		return {result: "Success!"};
	}
}
