/**
 * Variable composition analysis
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import path from "node:path";
import {openSync, closeSync, writeSync} from "node:fs";
import {gcd} from "mathjs";
import {dialog} from "electron";
import {NodeCore} from "../modules/NodeCore";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import {invertBasis} from "../modules/Helpers";
import {getAtomicSymbol} from "../modules/AtomData";
import {VariableCompositionAccumulator,
		type VariableComponent} from "../variable/Accumulator";
import {computeValid, distanceMethodsNames, fingerprintMethodsNames,
		type ComputeValidParameters} from "../variable/ComputeValid";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";
import {VariableCompositionConvexHull} from "../variable/ConvexHull";

/**
 * Grouping results
 * @notExported
 */
interface Recipe {
    /** Quantity of each component as string */
	key: string;
    /** Quantity of each component as array */
	parts: number[];
    /** Number of structures with the given composition */
	count: number;
}

export class VariableComposition extends NodeCore {

	private readonly accumulator = new VariableCompositionAccumulator();
	private enableAnalysis = false;
	private structure: Structure | undefined;
	private readonly hull = new VariableCompositionConvexHull(this.accumulator);

	// Mirror of the UI reactive state
	private readonly state = {
		filterOnDistance: false,
		distanceFromHull: 0.15,
		forceCutoff: false,
		manualCutoffDistance: 10,
		fingerprintingMethod: 0,
		binSize: 0.05,
		peakWidth: 0.02,
		distanceMethod: 0,
		fixTriangleInequality: false,
		removeDuplicates: true,
		duplicatesThreshold: 0.03,
		consolidateOutput: false
	};

	private options: ComputeValidParameters = {
		method: 0,
		forceCutoff: false,
		manualCutoffDistance: 10,
		distanceMethod: 0,
		binSize: 0.05,
		peakWidth: 0.02,
		fixTriangleInequality: false,
		duplicatesThreshold: 0.03,
		removeDuplicates: true,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",			 type: "invoke",	  callback: this.channelInit.bind(this)},
		{name: "reset",     	 type: "send",   	  callback: this.channelReset.bind(this)},
		{name: "compositions",	 type: "invoke",	  callback: this.channelCompositions.bind(this)},
		{name: "capture",		 type: "invoke",	  callback: this.channelCapture.bind(this)},
		{name: "save",			 type: "invoke",	  callback: this.channelSave.bind(this)},
		{name: "state",			 type: "send",		  callback: this.channelState.bind(this)},
		{name: "start",			 type: "invoke",	  callback: this.channelStart.bind(this)},
		{name: "analyze",		 type: "invokeAsync", callback: this.channelAnalyze.bind(this)},
		{name: "convex-hull",	 type: "invoke",	  callback: this.channelConvexHull.bind(this)},
		{name: "convex-hull-3d", type: "invoke",	  callback: this.channelConvexHull3D.bind(this)},
		{name: "filter",		 type: "invoke",	  callback: this.channelFilter.bind(this)},
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

		if(!data?.atoms.length) {
			return;
		}
		this.structure = data;

		if(this.enableAnalysis) {

			this.accumulator.add(data);

			sendToClient(this.id, "load", {
				countAccumulated: this.accumulator.size(),
				species: this.accumulator.symbols(),
				hasEnergies: this.accumulator.hasEnergies()
			});
		}
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.filterOnDistance = params.filterOnDistance as boolean ?? false;
    	this.state.distanceFromHull = params.distanceFromHull as number ?? 0.15;
		this.state.forceCutoff = params.forceCutoff as boolean ?? false;
    	this.state.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
    	this.state.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
    	this.state.binSize = params.binSize as number ?? 0.05;
    	this.state.peakWidth = params.peakWidth as number ?? 0.02;
    	this.state.distanceMethod = params.distanceMethod as number ?? 0;
    	this.state.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
    	this.state.removeDuplicates = params.removeDuplicates as boolean ?? true;
    	this.state.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.03;
		this.state.consolidateOutput = params.consolidateOutput as boolean ?? false;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Compute
	/**
	 * Verify step validity
	 *
	 * @param composition - Composition of the step to check
	 * @param parts - Computed percentages for each component
	 * @param nspecies - Number of species (is the size of step array)
	 * @param ncomponents - Number of components
	 * @param components - All components
	 * @returns Empty string if the step is the given combination of components,
	 * 			otherwise the error message
	 */
	private verify(composition: number[], parts: number[], nspecies: number,
				   ncomponents: number, components: number[]): string {

		for(let j=0; j < ncomponents; ++j) {
			const part = parts[j];
			if(!Number.isInteger(part) || part < 0) return `Invalid part ${j+1} "${part}"`;
		}

		for(let i=0; i < nspecies; ++i) {
			let count = 0;
			for(let j=0; j < ncomponents; ++j) {
				count += parts[j] * components[j*nspecies+i];
			}
			if(count !== composition[i]) return `Specie ${i+1} count mismatch`;
		}

		return "";
	}

	/**
	 * Fit composition into each loaded structure
	 *
	 * @param ncomponents - Number of components
	 * @param components - The components arranged as [component1, component2,...]
	 * 		where each component is: specie1, specie2, specie3,...
	 * @returns List of possible groups by percentage of each component
	 */
	private fitComposition(ncomponents: number, components: number[]): Recipe[] {

		const nspecies = components.length / ncomponents;

		// Find species unique for only one component
		const specialAtoms = Array<number>(ncomponents).fill(-1);
		const multiplicity = Array<number>(ncomponents).fill(1);
		for(let i=0; i < nspecies; ++i) {

			let whereIsUnique = -1;
			let multiple = 1;
			for(let j=0; j < ncomponents; ++j) {
				const mm = components[nspecies*j+i];
				if(mm !== 0) {
					multiple = mm;
					if(whereIsUnique === -1) whereIsUnique = j;
					else {whereIsUnique = -1; break;}
				}
			}

			if(whereIsUnique === -1) continue;

			// Which is the specie unique for each component and its multiplicity
			specialAtoms[whereIsUnique] = i;
			multiplicity[whereIsUnique] = multiple;
		}

		// Count components without a special atom. If only one could procede
		let minusOnes = 0;
		for(const entry of specialAtoms) if(entry === -1) ++minusOnes;
		if(minusOnes > 1) {

			sendAlertToClient("Cannot find simple solution", {node: "variableComposition"});
			return [];
		}

		const summary = new Map<string, {n: number[]; count: number}>();
		const parts = Array<number>(ncomponents).fill(0);
		const species = this.accumulator.species();
		let stepNumber = 1;
		for(const entry of this.accumulator.iterateStructures()) {

			const step = [];
			for(const z of species) {
				step.push(entry.species.get(z) ?? 0);
			}

			// If one component without special atom
			if(minusOnes) {

				// Compute parts for the components with one special atom
				let missing = 0;
				for(let i=0; i < ncomponents; ++i) {
					if(specialAtoms[i] === -1) {
						missing = i;
						continue;
					}
					parts[i] = step[specialAtoms[i]]/multiplicity[i];
				}

				// Subtract the known components
				const remain = [...step];
				for(let i=0; i < ncomponents; ++i) {
					if(specialAtoms[i] === -1) continue;
					for(let j=0; j < nspecies; ++j) {
						remain[j] -= parts[i]*components[i*nspecies+j];
					}
				}

				// Extract the remaining component
				for(let j=0; j < nspecies; ++j) {
					const n = components[missing*nspecies+j];
					if(n !== 0) parts[missing] = remain[j]/n;
				}
			}
			else {
				for(let i=0; i < ncomponents; ++i) {
					parts[i] = step[specialAtoms[i]]/multiplicity[i];
				}
			}

			const sts = this.verify(step, parts, nspecies, ncomponents, components);
			if(sts !== "") {

				sendAlertToClient(`Invalid composition for step ${stepNumber}: ${sts}`,
								  {node: "variableComposition"});
				return [];
			}

			const div = gcd(...parts);
			if(div > 1) {
				for(let i=0; i < ncomponents; ++i) {
					parts[i] /= div;
				}
			}
			entry.parts = [...parts];
			entry.key = parts.join("-");

			const key = parts.join("\u2009:\u2009");
			if(summary.has(key)) {
				summary.get(key)!.count++;
			}
			else {
				summary.set(key, {n: [...parts], count: 1});
			}

			++stepNumber;
		}

		const recipes: Recipe[] = [];
		for(const [key, value] of summary) {
			recipes.push({key, parts: value.n, count: value.count});
		}
		recipes.sort((a, b) => {
			for(let i=0; i < ncomponents; ++i) {
				if(a.parts[i] !== b.parts[i]) return a.parts[i] - b.parts[i];
			}
			return 0; // This cannot happen
		});

		return recipes;
	}

	/**
	 * Format entry as POSCAR file
	 *
	 * @param entry - One composition to convert to POSCAR
	 * @returns Content of the POSCAR file
	 */
	private entryToPoscar(entry: VariableComponent): string {

		let out = "Variable composition by STMng. " +
				  `Composition key: ${entry.key}. Step: ${entry.step} ` +
				  `Distance from convex hull: ${entry.distance.toFixed(4)}\n1.0\n`;

		const basisString = Array<string>(9);
		for(let i=0; i < 9; ++i) {
			basisString[i] = entry.basis[i].toFixed(10).padStart(15);
		}

		out += `${basisString[0]} ${basisString[1]} ${basisString[2]}\n`;
		out += `${basisString[3]} ${basisString[4]} ${basisString[5]}\n`;
		out += `${basisString[6]} ${basisString[7]} ${basisString[8]}\n`;

		out += entry.species.keys().map((z) => getAtomicSymbol(z)).toArray().join(" ") + "\n";
		out += entry.species.values().map((value) => value.toFixed(0)).toArray().join(" ");
		out += "\nDirect\n";

		// Compute inverse matrix
		const inverse = invertBasis(entry.basis);

		// For each atom compute the fractional coordinates
		const len = entry.atomsPosition.length;
		for(let i=0; i < len; i+=3) {

			const cx = entry.atomsPosition[i];
			const cy = entry.atomsPosition[i+1];
			const cz = entry.atomsPosition[i+2];

			const fx = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
			const fy = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
			const fz = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

			out += `${fx.toFixed(10).padStart(15)} ` +
				   `${fy.toFixed(10).padStart(15)} ` +
				   `${fz.toFixed(10).padStart(15)}\n`;
		}

		return out;
	}

	/**
	 * Filter structures on composition and distance from the convex hull
	 *
	 * @param selected - Selected compositions or undefined if all compositions are included
	 * @returns Remaining structures count
	 */
	private filterStructures(selected?: string[]): number {

		const hasSelected = selected !== undefined;

		// Normalize selected
		const selectedSet = new Set<string>();
		if(hasSelected) {
			for(const s of selected) {
				selectedSet.add(s.replaceAll("\u2009:\u2009", "-"));
			}
		}

		let enabled = 0;
		for(const entry of this.accumulator.iterateStructures()) {

			const isIncluded = !hasSelected || selectedSet.has(entry.key);
			entry.enabled = isIncluded;
			if(isIncluded) ++enabled;
		}

		if(!this.state.filterOnDistance) return enabled;

		// Compute distances from the convex hull
		this.hull.updateDistances();

		// Filter on distances
		for(const entry of this.accumulator.iterateEnabledStructures()) {

			if(entry.distance > this.state.distanceFromHull) {
				entry.enabled = false;
				--enabled;
			}
		}
		return enabled;
	}

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			species: this.accumulator.symbols(),
			countAccumulated: this.accumulator.size(),
			fingerprintMethods: fingerprintMethodsNames(),
			distanceMethods: distanceMethodsNames(),
			...this.state
		};
	}

	/**
	 * Channel handler for clearing the accumulated compositions
	 */
	private channelReset(): void {

		this.accumulator.clear();
	}

	/**
	 * Channel handler for compute compositions
	 *
	 * @returns List of compositions
	 */
	private channelCompositions(params: CtrlParams): CtrlParams {

		const ncomponents = params.componentsCount as number ?? 2;
		const components = params.components as number[] ?? [];

		const recipes = this.fitComposition(ncomponents, components);

		const sts = this.hull.prepareData(ncomponents);
		if(sts !== "") {
			sendAlertToClient(sts, {node: "variableComposition"});
			return {error: sts};
		}
		const remaining = this.filterStructures();

		return {
			recipes: JSON.stringify(recipes, ["key", "count"]),
			remaining
		};
	}

	/**
	 * Channel handler for variable composition accumulate change
	 *
	 * @param params - Variable composition accumulate status
	 * @returns Counts
	 */
	private channelCapture(params: CtrlParams): CtrlParams {

		this.enableAnalysis = params.enableAnalysis as boolean ?? false;
		if(this.enableAnalysis && this.structure) {
			this.accumulator.add(this.structure);
		}

		return {
			countAccumulated: this.accumulator.size(),
			species: this.accumulator.symbols(),
		};
	}

	/**
	 * Save compositions one per file in the given directory
	 *
	 * @param selected - All selected compositions codes (with "-" separator)
	 * @param dir - Directory where to save the compositions
	 * @returns Number of files saved
	 */
	private saveByComposition(selected: Set<string>, dir: string): number {

		let saved = 0;
		const hasEnergies = this.accumulator.hasEnergies();

		for(const entry of this.accumulator.iterateKeys()) {

			// If this key has been processed
			if(!selected.has(entry[0])) continue;

			// Check that at least one entry is enabled
			const toOrder = [];
			let valid = false;
			for(const idx of entry[1]) {
				const structure = this.accumulator.getEntry(idx);
				if(structure?.enabled) {
					valid = true;
					toOrder.push([structure.energy ?? 0, idx]);
				}
			}
			if(!valid) continue;

			// Order entries by increasing energy
			// (the distance from convex hull is proportional to energy,
			// so it is not relevant)
			entry[1] = toOrder.toSorted((a, b) => {
									const e = a[0] - b[0];
									if(e !== 0) return e;
									return a[1] - b[1];
								}).map((value) => value[1]);

			const name = `composition-${entry[0]}`;
			const dataFile = path.join(dir, `${name}.poscar`);
			const energyFile = path.join(dir, `${name}.energy`);

			const fd = openSync(dataFile, "w");
			const fde = hasEnergies ? openSync(energyFile, "w") : undefined;

			for(const idx of entry[1]) {

				const structure = this.accumulator.getEntry(idx)!;
				if(!structure?.enabled) continue;

				writeSync(fd, this.entryToPoscar(structure));
				if(fde !== undefined) writeSync(fde, `${structure.energy?.toFixed(6) ?? "0"}\n`);
			}
			closeSync(fd);
			if(fde !== undefined) closeSync(fde);
			++saved;
		}

		return saved;
	}

	/**
	 * Save all compositions in one file in the given directory
	 *
	 * @param selected - All selected compositions codes (separated by "-")
	 * @param dir - Directory where to save the compositions
	 * @returns Number of files saved, that is, one
	 */
	private saveAllCompositions(selected: Set<string>, dir: string): number {

		const hasEnergies = this.accumulator.hasEnergies();

		const all: [number, number, number][] = [];

		for(const entry of this.accumulator.iterateKeys()) {

			// If this key has been processed
			if(!selected.has(entry[0])) continue;

			for(const idx of entry[1]) {
				const structure = this.accumulator.getEntry(idx);
				if(structure?.enabled) {
					const energy = structure.energy ?? 0;
					all.push([structure.distance, energy, idx]);
				}
			}
		}

		// Order entries by increasing distance from convex hull and then energy
		all.sort((a, b) => {
			const d = a[0] - b[0];
			if(d !== 0) return d;
			const e = a[1] - b[1];
			if(e !== 0) return e;
			return a[2] - b[2];
		});

		const name = "composition-all";
		const dataFile = path.join(dir, `${name}.poscar`);
		const energyFile = path.join(dir, `${name}.energy`);

		const fd = openSync(dataFile, "w");
		const fde = hasEnergies ? openSync(energyFile, "w") : undefined;

		for(const one of all) {

			const structure = this.accumulator.getEntry(one[2])!;
			if(!structure?.enabled) continue;

			writeSync(fd, this.entryToPoscar(structure));
			if(fde !== undefined) writeSync(fde, `${one[1].toFixed(6)}\n`);
		}
		closeSync(fd);
		if(fde !== undefined) closeSync(fde);

		return 1;
	}

	/**
	 * Channel handler for saving results into files in a directory
	 *
	 * @returns Count saved or -1 if not selected
	 */
	private channelSave(params: CtrlParams): CtrlParams {

		const selectedRaw = params.selected as string[] ?? [];
		if(selectedRaw.length === 0) return {saved: -1};
		const nc = params.componentsCount as number ?? 2;
		if(nc === 0) return {saved: -1};

		const hasEnergies = this.accumulator.hasEnergies();
		if(hasEnergies && nc > 0) {
			const sts = this.hull.prepareData(nc);
			if(sts !== "") {
				sendAlertToClient(sts, {node: "variableComposition"});
				return {saved: -1};
			}
			this.hull.updateDistances();
		}

		const selected = new Set<string>();
		for(const s of selectedRaw) {
			selected.add(s.replaceAll("\u2009:\u2009", "-"));
		}

		const dir = dialog.showOpenDialogSync({
			title: "Output directory",
			properties: ["openDirectory"],
		});
		if(!dir) return {saved: -1};

		this.accumulator.initializeKeyMap();

		const saved = this.state.consolidateOutput ?
								this.saveAllCompositions(selected, dir[0]) :
								this.saveByComposition(selected, dir[0]);

		sendAlertToClient(`Saved ${saved} variable composition file${saved === 1 ? "" : "s"}`,
						  {level: "success"});

		return {saved};
	}

	/**
	 * Channel handler for saving the UI status
	 */
	private channelState(params: CtrlParams): void {

		this.initializeState(params);
	}

	private channelFilter(params: CtrlParams): CtrlParams {

		this.state.filterOnDistance = params.filterOnDistance as boolean ?? false;
        this.state.distanceFromHull = params.distanceFromHull as number ?? 0.15;

		const remaining = this.filterStructures(params.selected as string[] ?? []);

		return {
			countAccumulated: this.accumulator.size(),
            remaining,
		};
	}

	/**
	 * Channel handler to start analyzing the compositions
	 *
	 * @returns Error message or empty on success
	 */
	private channelStart(params: CtrlParams): CtrlParams {

		this.accumulator.initializeKeyMap();

		this.options = {
			method: params.fingerprintingMethod as number ?? 0,
			forceCutoff: params.forceCutoff as boolean ?? false,
			manualCutoffDistance: params.manualCutoffDistance as number ?? 10,
			distanceMethod: params.distanceMethod as number ?? 0,
			binSize: params.binSize as number ?? 0.05,
			peakWidth: params.peakWidth as number ?? 0.02,
			fixTriangleInequality: params.fixTriangleInequality as boolean ?? false,
			duplicatesThreshold: params.duplicatesThreshold as number ?? 0.03,
			removeDuplicates: params.removeDuplicates as boolean ?? true,
		};

		if(this.options.method < 0 || this.options.method > 2) {
			return {error: "Invalid fingerprinting method"};
		}
		if(this.options.forceCutoff && this.options.manualCutoffDistance <= 0) {
			return {error: "Invalid manual cutoff distance"};
		}
		if(this.options.binSize <= 0 || this.options.peakWidth < 0) {
			return {error: "Invalid fingerprinting parameters"};
		}
		if(this.options.distanceMethod < 0 || this.options.distanceMethod > 2) {
			return {error: "Invalid distance method"};
		}
		if(this.options.duplicatesThreshold <= 0) {
			return {error: "Invalid duplicates threshold"};
		}

		return {};
	}

	/**
	 * Channel handler for analyzing the results of a single composition
	 *
	 * @returns Analysis result status
	 */
	private async channelAnalyze(params: CtrlParams): Promise<CtrlParams> {

		const key = params.key as string;
		if(!key) return {error: "Empty key", key};

		const indices = this.accumulator.getIndicesForKey(key);
		if(!indices?.length) return {error: "Key not found", key};
		if(indices.length === 1) {
			const entry = this.accumulator.getEntry(indices[0]);
			if(entry === undefined) return {error: "Key not found", key};
			const count  = entry.enabled? 1 : 0;

			return {status: "OK!", total: count, valid: count, key};
		}

		// Count number of valid structures for the given key
		const validIndices: number[] = [];
		let count = 0;
		for(const idx of indices) {
			const entry = this.accumulator.getEntry(idx);
			if(entry === undefined) continue;
			if(entry.enabled) {
				validIndices.push(idx);
				++count;
			}
		}

		// Do nothing except grouping structures
		if(!this.options.removeDuplicates || count === 0) {

			return {status: "OK!", total: count, valid: count, key};
		}

		const status = await computeValid(this.accumulator, validIndices, this.options);
		if(status.error) return {error: status.error, key};
		return {status: "OK!", total: indices.length, valid: status.count, key};
	}

	/**
	 * Channel handler to start analyzing the compositions
	 *
	 * @returns Error message or empty on success
	 */
	private channelConvexHull(params: CtrlParams): CtrlParams {

		const dimension = params.dimension as number ?? 0;

		const result = this.hull.prepareData(dimension);

		if(result) return {error: result};

		// Open the chart if so requested
		const showChart = params.showChart as boolean ?? false;
		if(showChart) {

			createOrUpdateSecondaryWindow({
				routerPath: "/components-hull",
				width: 1000,
				height: 900,
				title: "Variable composition convex hull",
				data: this.hull.dataForDisplay()
			});
		}
		return {status: "OK!"};
	}

	/**
	 * Channel handler to start analyzing the compositions
	 *
	 * @returns Error message or empty on success
	 */
	private channelConvexHull3D(params: CtrlParams): CtrlParams {

		const dimension = params.dimension as number ?? 0;

		const result = this.hull.prepareData(dimension);

		if(result) return {error: result};

		// Open the chart if so requested
		const show3DView = params.show3DView as boolean ?? false;
		if(show3DView) {

			createOrUpdateSecondaryWindow({
				routerPath: "/hull-3d",
				width: 1130,
				height: 900,
				title: "Variable composition 3D convex hull",
				data: this.hull.dataForDisplay3D()
			});
		}
		return {status: "OK!"};
	}
}
