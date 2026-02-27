/**
 * Interface to Pymatgen Aflow prototype matcher and the fingerprint
 * based collection matchers.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-20
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {NodeCore} from "../modules/NodeCore";
import {hasNoUnitCell} from "../modules/Helpers";
import {markDuplicates} from "../modules/MarkDuplicates";
import {sendToClient} from "../modules/ToClient";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen, sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {collectionGetNearestStructures, collectionGetStructure} from "../modules/CollectionDb";
import {findMatchingPrototypes, prototypeGetStructure} from "../modules/PrototypeDb";
import type {Atom, ChannelDefinition, Crystal, CtrlParams,
			 FingerprintingParameters, PrototypeAtomsData, Structure} from "@/types";

export class FindSimilar extends NodeCore {

	private structure: Structure | undefined;
	private formula = "";

	private readonly idCollection: string[] = [];
	private readonly titleCollection: string[] = [];
	private readonly distance: number[] = [];
	private readonly colorBand: string[] = [];
	private readonly idPrototypes: string[] = [];
	private readonly titlePrototypes: string[] = [];

	// Mirror of the UI reactive state
	private readonly state = {
		enabled: false,
		numberMatches: 3,
		lengthTolerance: 0.2,
		siteTolerance: 0.3,
		angleTolerance: 5,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "state",		type: "send",	callback: this.channelState.bind(this)},
		{name: "show",		type: "invoke",	callback: this.channelShow.bind(this)},
		{name: "matches",	type: "send",	callback: this.channelMatches.bind(this)},
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

		if(isSecondaryWindowOpen("/matches")) {

			const dataToSend: CtrlParams = {
				id: this.id,
				idCollection: this.idCollection,
				titleCollection: this.titleCollection,
				distance: this.distance,
				color: this.colorBand,
				aflow: this.idPrototypes,
				titlePrototypes: this.titlePrototypes
			};

			sendToSecondaryWindow("/matches", dataToSend);
		}
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
				distances: [],
				color: [],
				spaceGroup: ""
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

		this.formula = this.getChemicalFormula(this.structure, duplicates);

		// Compute the input structure fingerprint
		const fp = this.computeFingerprint(atoms, crystal, duplicates);

		// Find similar
		const results = collectionGetNearestStructures(fp, this.state.numberMatches);

		// Prepare the data for the client
		this.idCollection.length = 0;
		this.titleCollection.length = 0;
		this.distance.length = 0;
		this.colorBand.length = 0;

		for(const result of results) {
			this.titleCollection.push(result.title);
			this.idCollection.push(result.id);
			this.distance.push(result.distance!);
			this.colorBand.push(this.getBand(result.distance!));
		}
		sendToClient(this.id, "load-coll", {
			titles: this.titleCollection,
			ids: this.idCollection,
			distances: this.distance,
			color: this.colorBand,
			spaceGroup: this.structure!.crystal.spaceGroup
		});
	}

	/**
	 * Assign color for the distance range
	 *
	 * @param distance - Structure distance from the input one
	 * @returns Color based on distance
	 */
	private getBand(distance: number): string {

		// #FF1700		>0.15 - questionable relatives
		// #FFC200		0.12-0.15 distant relatives
		// #D5FF00		0.04-0.12 - related structures
		// #00FF00		up to 0.04 mean identical structures

		if(distance <= 0.04) return "#00FF00";
		if(distance <= 0.12) return "#D5FF00";
		if(distance <= 0.15) return "#FFC200";
		return "#FF0000";
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

		const matches = findMatchingPrototypes(this.structure!,
			this.state.lengthTolerance,
			this.state.siteTolerance,
			this.state.angleTolerance);

		// Prepare the data for the client
		this.idPrototypes.length = 0;
		this.titlePrototypes.length = 0;
		const len = matches.aflow.length;
		for(let i=0; i < len; ++i) {

			this.idPrototypes.push(matches.aflow[i]);
			this.titlePrototypes.push(matches.mineral[i]);
		}

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
	 * @param duplicates - Atoms marked as duplicates and thus ignored
	 * @returns HTML string with the structure empirical formula
	 */
	private getChemicalFormula(structure: Structure | undefined, duplicates: boolean[]): string {

		if(!structure || structure.atoms.length === 0) return "";

		const species = new Map<number, number>();
		let idx = 0;
		for(const atom of structure.atoms) {
			if(duplicates[idx++]) continue;
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
	private channelShow(params: CtrlParams): CtrlParams {

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
			const prototype = prototypeGetStructure(id);
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
	 */
	private channelMatches(): void {

		const dataToSend: CtrlParams = {
			id: this.id,
			idCollection: this.idCollection,
			titleCollection: this.titleCollection,
			distance: this.distance,
			color: this.colorBand,
			aflow: this.idPrototypes,
			titlePrototypes: this.titlePrototypes
		};

		createOrUpdateSecondaryWindow({
			routerPath: "/matches",
			width: 850,
			height: 700,
			title: "Structure matches in prototypes and collection",
			data: dataToSend
		});
	}
}
