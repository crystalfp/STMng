/**
 * Interface to the fingerprint based collection matcher.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-10-25
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {NodeCore} from "../modules/NodeCore";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "../modules/WindowsUtilities";
import {getAtomData, getAtomicSymbol} from "../modules/AtomData";
import {markDuplicates} from "../modules/MarkDuplicates";
import {hasNoUnitCell} from "../modules/Helpers";
import {sendToClient} from "../modules/ToClient";
import {getStructure, collectionsGetNearestStructures, getMetadata} from "../modules/StructureCollection";
import {fingerprintingOganovValle} from "../fingerprint/OganovValleFingerprint";
import type {Structure, ChannelDefinition, CtrlParams, Atom, Crystal,
			 PrototypeAtomsData, FingerprintingParameters} from "@/types";

export class FindSimilar extends NodeCore {

	private structure: Structure | undefined;
	private formula = "";

	private readonly idCollections: number[] = [];
	private readonly titleCollections: string[] = [];
	private readonly distances: number[] = [];
	private readonly colors: string[] = [];
	private readonly isPrototype: number[] = [];
	private readonly aflow: string[] = [];

	// Mirror of the UI reactive state
	private readonly state = {
		enabled: false,
		numberMatches: 3,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke", callback: this.channelInit.bind(this)},
		{name: "info",		type: "send",	callback: this.channelInfo.bind(this)},
		{name: "state",		type: "send",	callback: this.channelState.bind(this)},
		{name: "show",		type: "invoke",	callback: FindSimilar.channelShow.bind(this)},
		{name: "matches",	type: "send",	callback: this.channelMatches.bind(this)},
	];

	/**
	 * Create the node
	 *
	 * @param id - The node ID
	 */
	constructor(id: string) {
		super(id);
		NodeCore.setupChannels(id, this.channels);
	}

	description(): string {
		return "Matches input structure against two collections of structures: known crystallographic “Prototypes” structures from the Encyclopedia of crystallographic prototypes and a “Collection” of interesting structures from various sources";
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.enabled = params.enabled as boolean ?? false;
        this.state.numberMatches = params.numberMatches as number ?? 1;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Input structure
	override fromPreviousNode(data: Structure): void {

		if(!data?.atoms.length) return;
		this.structure = data;
		const {atoms, crystal} = this.structure;
		const {basis, spaceGroup} = crystal;

		if(hasNoUnitCell(basis)) {
			sendToClient(this.id, "load-info", {error: "Structure has no unit cell"});
			return;
		}

		// Remove duplicate and outside unit cell atoms
		const duplicates = markDuplicates(atoms, crystal);

		this.formula = FindSimilar.getChemicalFormula(this.structure, duplicates);

		sendToClient(this.id, "load-info", {formula: this.formula, spaceGroup});

		if(!this.state.enabled) return;
		this.findSimilar();

		if(!isSecondaryWindowOpen("/matches")) return;

		const dataToSend: CtrlParams = {
			id: this.id,
			idCollections: this.idCollections,
			titleCollections: this.titleCollections,
			distances: this.distances,
			colors: this.colors,
			aflow: this.aflow,
			isPrototype: this.isPrototype,
			spaceGroup: this.structure.crystal.spaceGroup,
			formula: this.formula
		};

		sendToSecondaryWindow("/matches", dataToSend);
	}

	// > Computation
	/**
	 * Compute fingerprint of the input structure
	 *
	 * @param atoms - Input structure atoms
	 * @param crystal - Input structure crystal data
	 * @param duplicates - True for atoms that should be ignored
	 * @returns The fingerprint
	 */
	private static computeFingerprint(atoms: Atom[],
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

	private findSimilar(): void {

		// Nothing to do
		if(!this.state.enabled ||
		   !this.structure?.atoms.length ||
		   hasNoUnitCell(this.structure.crystal.basis)) {

			sendToClient(this.id, "results", {
				idCollections: [],
				titleCollections: [],
				distances: [],
				colors: [],
				isPrototype: [],
				aflow: [],
			});

			return;
		}

		const {atoms, crystal} = this.structure;

		// Remove duplicate and outside unit cell atoms
		const duplicates = markDuplicates(atoms, crystal);

		this.formula = FindSimilar.getChemicalFormula(this.structure, duplicates);

		// Compute the input structure fingerprint
		const fp = FindSimilar.computeFingerprint(atoms, crystal, duplicates);

		// Find similar
		const results = collectionsGetNearestStructures(fp, this.state.numberMatches);

		// Prepare the data for the client
		this.idCollections.length = 0;
		this.titleCollections.length = 0;
		this.distances.length = 0;
		this.colors.length = 0;
		this.isPrototype.length = 0;
		this.aflow.length = 0;

		for(const {title, id, distance} of results) {

			const entry = getMetadata(id);
			if(!entry) continue;

			this.titleCollections.push(title);
			this.idCollections.push(id);
			this.distances.push(distance);
			this.colors.push(FindSimilar.getBand(distance));

			this.aflow.push(entry.proto ? entry.aflow ?? "" : "");
			this.isPrototype.push(entry.proto ? 1 : 0);
		}

		sendToClient(this.id, "results", {
			idCollections: this.idCollections,
			titleCollections: this.titleCollections,
			distances: this.distances,
			isPrototype: this.isPrototype,
			aflow: this.aflow,
			colors: this.colors
		});
	}

	/**
	 * Get the input structure empirical formula
	 *
	 * @param structure - Input structure
	 * @param duplicates - Atoms marked as duplicates and thus ignored
	 * @returns HTML string with the structure empirical formula
	 */
	private static getChemicalFormula(structure: Structure | undefined,
									  duplicates: boolean[]): string {

		if(!structure || structure.atoms.length === 0) return "";

		const species = new Map<number, number>();
		let idx = 0;
		for(const {atomZ} of structure.atoms) {
			if(duplicates[idx++]) continue;

			species.set(atomZ, species.has(atomZ) ? species.get(atomZ)! + 1 : 1);
		}
		let formula = "";
		for(const [k, v] of species) {

			const sub = v === 1 ? "" : `<sub>${v}</sub>`;
			const atomType = getAtomicSymbol(k);
			formula += `${atomType}${sub}`;
		}
		return formula;
	}

	/**
	 * Format the atoms for display
	 *
	 * @param atoms - Structure atoms
	 * @returns JSON formatted string with atoms for the visualizer
	 */
	private static formatAtoms(atoms: Atom[]): string {

		const out: PrototypeAtomsData = {
			positions: [],
			labels: [],
			radius: [],
			color: [],
		};

		for(const {position, label, atomZ} of atoms) {

			out.positions.push(...position);
			out.labels.push(label);

			const ad = getAtomData(atomZ);
			out.radius.push(ad.rCov);
			out.color.push(ad.color);
		}

		return JSON.stringify(out);
	}

	/**
	 * Assign color for the distance range
	 *
	 *	 #FF1700		over 0.15  - questionable relatives
	 *	 #FFC200		0.12-0.15  - distant relatives
	 *	 #D5FF00		0.04-0.12  - related structures
	 *	 #00FF00		up to 0.04 - identical structures
	 *
	 * @param distance - Structure distance from the input one
	 * @returns Color based on distance
	 */
	private static getBand(distance: number): string {

	    if(distance <= 0.04) return "#00FF00";
        if(distance <= 0.12) return "#D5FF00";
		return distance <= 0.15 ? "#FFC200" : "#FF0000";
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
	 * Channel handler for getting input structure data
	 */
	private channelInfo(): void {

		if(!this.structure) return;

		const {crystal} = this.structure;
		const {spaceGroup} = crystal;

		sendToClient(this.id, "load-info", {formula: this.formula, spaceGroup});
	}

	/**
	 * Channel handler for display the structure matched
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private static channelShow(params: CtrlParams): CtrlParams {

		const id = params.id as number;
		if(id === undefined) return {result: "Empty file ID"};

		const result = getStructure(id);
		if(result === undefined) {
			const message = `File for ID "${id}" not found`;
			return {error: message};
		}
		const dataForClient: CtrlParams = result.proto ?
			{
				aflow: result.aflow,
				pearson: result.pearson ?? "",
				strukturbericht: result.strukturbericht ?? "",
				mineral: result.title,
				matrix: result.structure.crystal.basis,
				atoms: FindSimilar.formatAtoms(result.structure.atoms)
			} : {
				matrix: result.structure.crystal.basis,
				atoms: FindSimilar.formatAtoms(result.structure.atoms),
				mineral: result.title,
			};

		createOrUpdateSecondaryWindow({
			routerPath: "/prototype",
			width: 1400,
			height: 900,
			title: "Structure from collections",
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
			idCollections: this.idCollections,
			titleCollections: this.titleCollections,
			distances: this.distances,
			colors: this.colors,
			aflow: this.aflow,
			isPrototype: this.isPrototype,
			spaceGroup: this.structure!.crystal.spaceGroup,
			formula: this.formula
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
