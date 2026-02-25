/**
 * Interface to Pymatgen Aflow prototype matcher and the fingerprint
 * based collection matchers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
 */
import {NodeCore} from "../modules/NodeCore";
import {hasNoUnitCell} from "../modules/Helpers";
import {markDuplicates} from "../modules/MarkDuplicates";
import {sendToClient} from "../modules/ToClient";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import {collectionGetNearestStructures, collectionGetStructure} from "../modules/CollectionDb";
import {findMatchingPrototypes, prototypeGetStructure} from "../modules/PrototypeDb";
import type {Atom, ChannelDefinition, Crystal, CtrlParams,
			 FingerprintingParameters, PrototypeAtomsData, Structure} from "@/types";

export class Matchers extends NodeCore {

	private structure: Structure | undefined;
	private formula = "";

	// Mirror of the UI reactive state
	private state = {
		enabled: false,
		numberMatches: 3,
		lengthTolerance: 0.2,
		siteTolerance: 0.3,
		angleTolerance: 5,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", 		callback: this.channelInit.bind(this)},
		{name: "state",		type: "send",			callback: this.channelState.bind(this)},
		{name: "show",		type: "invokeAsync",	callback: this.channelShow.bind(this)},
		{name: "matches",	type: "send",			callback: this.channelMatches.bind(this)},
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

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.enabled = params.enabled as boolean ?? false;
        this.state.numberMatches = params.numberMatches as number ?? 1;
		this.state.lengthTolerance = params.lengthTolerance as number ?? 0.2;
		this.state.siteTolerance = params.siteTolerance as number ?? 0.3;
		this.state.angleTolerance = params.angleTolerance as number ?? 5;
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
	 * Find matching structure in the collection and prototypes
	 */
	private findSimilar(): void {

		// Nothing to do
		if(!this.state.enabled ||
		   !this.structure?.atoms.length ||
		   hasNoUnitCell(this.structure.crystal.basis)) {

			sendToClient(this.id, "load-coll", {
				titles: [],
				ids: [],
				distances: []
			});

			sendToClient(this.id, "load-proto", {
				titles: [],
				aflow: [],
				formula: ""
			});

			return;
		}

		this.findSimilarInCollection();
		this.findSimilarInPrototypes();
	}

	/**
	 * Find similar structures from the collection
	 */
	private findSimilarInCollection(): void {

		const {atoms, crystal} = this.structure!;

		// Remove duplicate and outside unit cell atoms
		const duplicates = markDuplicates(atoms, crystal);

		// Compute the input structure fingerprint
		const fp = this.computeFingerprint(atoms, crystal, duplicates);

		// Find similar
		const results = collectionGetNearestStructures(fp, this.state.numberMatches);

		// Prepare the data for the client
		const titles: string[] = [];
		const ids: string[] = [];
		const distances: number[] = [];

		for(const result of results) {
			titles.push(result.title);
			ids.push(result.id);
			distances.push(result.distance!);
		}
		sendToClient(this.id, "load-coll", {
			titles,
			ids,
			distances
		});
	}

	/**
	 * Compute fingerprint of the input structure
	 *
	 * @param atoms - Input structure atoms
	 * @param crystal - Input structure crystal data
	 * @param duplicates - True for atoms that should be ignored
	 * @returns The fingerprint
	 */
	private computeFingerprint(atoms: Atom[],
							   crystal: Crystal,
							   duplicates: boolean[]): Float64Array {

		// Should be the same values set in the preprocessor
		const params: FingerprintingParameters = {

			method: 0,
			areNanoclusters: false,
			cutoffDistance: 20,
			binSize: 0.06,
			peakWidth: 0.02,
			processParallelism: false
		};

		// Compute the effective number of atoms
		let natoms = 0;
		for(let i=0; i < atoms.length; ++i) {

			if(!duplicates[i]) ++natoms;
		}

		const basis: Float64Array = new Float64Array(9);
		const positions: Float64Array = new Float64Array(natoms*3);
		const atomsZ: Int32Array = new Int32Array(natoms);

		for(let i=0; i < 9; ++i) {
			basis[i] = crystal.basis[i];
		}

		for(let i=0, j=0, j3=0; i < atoms.length; ++i) {

			if(duplicates[i]) continue;

			atomsZ[j++] = 1;
			positions[j3++] = atoms[i].position[0] - crystal.origin[0];
			positions[j3++] = atoms[i].position[1] - crystal.origin[1];
			positions[j3++] = atoms[i].position[2] - crystal.origin[2];
		}

		const result = fingerprintingOganovValle(params, basis, natoms, positions, atomsZ);

		return result.fingerprint;
	}

	/**
	 * Find similar structures from the prototypes
	 */
	private findSimilarInPrototypes(): void {

		const hasInput = this.structure !== undefined && this.structure?.atoms.length > 0;
		this.formula = hasInput ? this.getChemicalFormula(this.structure!) : "";

		const matches = findMatchingPrototypes(this.structure!,
			this.state.lengthTolerance,
			this.state.siteTolerance,
			this.state.angleTolerance);

		sendToClient(this.id, "load-proto", {
			titles: matches.mineral,
			aflow: matches.aflow,
			formula: this.formula
		});
	}

	/**
	 * Get the input structure empirical formula
	 *
	 * @param structure - Input structure
	 * @returns HTML string with the structure empirical formula
	 */
	private getChemicalFormula(structure: Structure): string {

		const species = new Map<number, number>();
		for(const atom of structure.atoms) {
			if(species.has(atom.atomZ)) {
				species.set(atom.atomZ, species.get(atom.atomZ)! + 1);
			}
			else {
				species.set(atom.atomZ, 1);
			}
		}
		let formula = "";
		for(const [k, v] of species) {

			const sub = v === 1 ? "" : `<sub>${v}</sub>`;
			const atomType = getAtomicSymbol(k);
			formula += `${atomType}${sub}`;
		}
		return formula;
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
        	numberMatches: this.state.numberMatches,
			lengthTolerance: this.state.lengthTolerance,
			siteTolerance: this.state.siteTolerance,
			angleTolerance: this.state.angleTolerance,
		};
	}

	/**
	 * Channel handler for saving the UI status and start computation
	 *
	 * @param params - Status from client
	 */
	private channelState(params: CtrlParams): void {

		this.initializeState(params);

		this.findSimilar();
	}

	/**
	 * Format the atoms for display
	 *
	 * @param atoms - Structure atoms
	 * @returns JSON formatted string with atoms for the visualizer
	 */
	private formatAtoms(atoms: Atom[]): string {

		const out: PrototypeAtomsData = {
			positions: [],
			labels: [],
			radius: [],
			color: [],
		};

		for(const atom of atoms) {

			out.positions.push(...atom.position);
			out.labels.push(atom.label);

			const ad = getAtomData(atom.atomZ);
			out.radius.push(ad.rCov);
			out.color.push(ad.color);
		}

		return JSON.stringify(out);
	}

	/**
	 * Channel handler for display the structure matched
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private async channelShow(params: CtrlParams): Promise<CtrlParams> {

		const id = params.id as string;
		if(!id) return {result: "Empty file ID"};
		const isCollection = params.isCollection as boolean ?? false;

		let dataForClient: CtrlParams;
		if(isCollection) {
			const structure = collectionGetStructure(id);
			if(structure === undefined) {
				const message = `File for ID "${id}" not found`;
				return {error: message};
			}

			dataForClient = {
				matrix: structure.crystal.basis,
				atoms: this.formatAtoms(structure.atoms)
			};
		}
		else {
			const prototype = await prototypeGetStructure(id);
			if(prototype === undefined) {
				const message = `File for Aflow "${id}" not found`;
				return {error: message};
			}

			dataForClient = {
				aflow: id,
				pearson: prototype.pearson,
				strukturbericht: prototype.strukturbericht,
				mineral: prototype.mineral,
				matrix: prototype.structure.crystal.basis,
				atoms: this.formatAtoms(prototype.structure.atoms)
			};
		}

		createOrUpdateSecondaryWindow({
			routerPath: "/prototype",
			width: 1400,
			height: 900,
			title: "Collection structure",
			data: dataForClient
		});

		return {result: "Success!"};
	}

	/**
	 * Channel handler for opening a secondary window with matches
	 *
	 * @param params - Matchers results
	 */
	private channelMatches(params: CtrlParams): void {

		createOrUpdateSecondaryWindow({
			routerPath: "/matches",
			width: 850,
			height: 700,
			title: "Structure matches in prototypes and collection",
			data: params
		});
	}
}
