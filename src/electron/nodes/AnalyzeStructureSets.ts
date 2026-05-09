/**
 * Structure sets analysis
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-24
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
import {StructureSetsAccumulator} from "../analysis/Accumulator";
import {computeValid, distanceMethodsNames, fingerprintMethodsNames,
		type ComputeValidParameters} from "../analysis/ComputeValid";
import {createOrUpdateSecondaryWindow} from "../modules/WindowsUtilities";
import {VariableCompositionConvexHull} from "../analysis/ConvexHull";
import {computeTransitions, type TransitionTable} from "../analysis/EnthalpyTransitions";
import {entryToPoscar} from "../modules/EntryToPoscar";
import {quickHull} from "@derschmale/tympanum";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";

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

export class AnalyzeStructureSets extends NodeCore {

	private readonly accumulator = new StructureSetsAccumulator();
	private enableAnalysis = false;
	private structure: Structure | undefined;
	private readonly hull = new VariableCompositionConvexHull(this.accumulator);
	private transitionTable: TransitionTable = {
		steps: [],
		formulas: [],
		pressures: []
	};

	// Mirror of the UI reactive state
	private readonly state = {
		numberComponents: 2,
		filterStructures: true,
		distanceFromHull: 0.15,
		energyFromMinimum: 0.1,
		forceCutoff: true,
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
		forceCutoff: true,
		manualCutoffDistance: 10,
		distanceMethod: 0,
		binSize: 0.05,
		peakWidth: 0.02,
		fixTriangleInequality: false,
		duplicatesThreshold: 0.03,
		removeDuplicates: true,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",			   type: "invoke",	    callback: this.channelInit.bind(this)},
		{name: "reset",     	   type: "send",   	    callback: this.channelReset.bind(this)},
		{name: "compositions",	   type: "invoke",	    callback: this.channelCompositions.bind(this)},
		{name: "capture",		   type: "invoke",	    callback: this.channelCapture.bind(this)},
		{name: "save",			   type: "invoke",	    callback: this.channelSave.bind(this)},
		{name: "state",			   type: "send",	  	callback: this.channelState.bind(this)},
		{name: "start",			   type: "invoke",	    callback: this.channelStart.bind(this)},
		{name: "analyze",		   type: "invokeAsync", callback: this.channelAnalyze.bind(this)},
		{name: "analyze-simple",   type: "invoke",	    callback:
																this.channelAnalyzeSimple.bind(this)},
		{name: "convex-hull",	   type: "invoke",	    callback: this.channelConvexHull.bind(this)},
		{name: "convex-hull-3d",   type: "invoke",	    callback: this.channelConvexHull3D.bind(this)},
		{name: "filter",		   type: "invoke",	    callback: this.channelFilter.bind(this)},
		{name: "transitions",	   type: "invoke",	    callback: this.channelTransitions.bind(this)},
		{name: "save-transitions", type: "send",	    callback:
																this.channelSaveTransitions.bind(this)},
		{name: "ev-chart",	   	   type: "invoke",	    callback: this.channelEVChart.bind(this)},
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

	description(): string {
		return "Analyze set of structures with 1 to 4 components to remove duplicates structures. At the end could show a chart of the convex hull results and could save the reduced compositions in different files or consolidate them in a single one. Computes also the enthalpy transition under pressure changes.";
	}

	override fromPreviousNode(data: Structure): void {

		if(!data?.atoms.length) {
			this.accumulator.clear();
			sendToClient(this.id, "load", {
				countAccumulated: 0,
				countRemaining: 0,
				species: [],
			});
			return;
		}
		this.structure = data;

		if(this.enableAnalysis) {

			this.accumulator.add(data);

			let remaining = 0;
			if(this.state.filterStructures && this.state.numberComponents === 1) {
				remaining = this.filterOnEnergy();
			}

			sendToClient(this.id, "load", {
				countAccumulated: this.accumulator.size(),
				countRemaining: remaining,
				species: this.accumulator.symbols(),
			});
		}
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   	    this.state.filterStructures = params.filterStructures as boolean ?? true;
   	    this.state.energyFromMinimum = params.energyFromMinimum as number ?? 0.1;
    	this.state.distanceFromHull = params.distanceFromHull as number ?? 0.15;
		this.state.forceCutoff = params.forceCutoff as boolean ?? true;
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
			if(!Number.isInteger(part) || part < 0) {
				return `Invalid part ${j+1} "${part}"`;
			}
		}

		for(let i=0; i < nspecies; ++i) {
			let count = 0;
			for(let j=0; j < ncomponents; ++j) {
				count += parts[j] * components[j*nspecies+i];
			}
			if(count !== composition[i]) {
				return `Specie ${i+1} count mismatch`;
			}
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

			sendAlertToClient("Cannot find simple solution", {node: "analyzeStructureSets"});
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
								  {node: "analyzeStructureSets"});
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
	 * Filter structures on composition and distance from the convex hull
	 *
	 * @param selected - Selected compositions or undefined if all compositions are included
	 * @returns Remaining structures count
	 */
	private filterStructures(): number {

		let enabled = 0;
		for(const entry of this.accumulator.iterateStructures()) {

			entry.enabled = true;
			++enabled;
		}

		if(!this.state.filterStructures) return enabled;

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

	/**
	 * Filter structures on distance from the set minimum energy
	 */
	private filterOnEnergy(): number {

		let countEnabled = 0;
		if(!this.state.filterStructures) {

			for(const entry of this.accumulator.iterateStructures()) {
				entry.enabled = true;
				++countEnabled;
			}
			return countEnabled;
		}

		let minEnergy = Number.POSITIVE_INFINITY;

		for(const entry of this.accumulator.iterateStructures()) {
			if(entry.energyPerAtom < minEnergy) minEnergy = entry.energyPerAtom;
		}

		const threshold = minEnergy + this.state.energyFromMinimum;

		for(const entry of this.accumulator.iterateStructures()) {
			if(entry.energyPerAtom > threshold) entry.enabled = false;
			else {
				entry.enabled = true;
				++countEnabled;
			}
		}

		return countEnabled;
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
		const remaining0 = this.filterStructures();

		if(remaining0 === 0) {
			const message = "Please reload data or change filter parameters";
			sendAlertToClient(message, {node: "analyzeStructureSets"});
			return {error: message};
		}

		const sts = this.hull.prepareData(ncomponents);
		if(sts !== "") {
			sendAlertToClient(sts, {node: "analyzeStructureSets"});
			return {error: sts};
		}
		const remaining = this.filterStructures();

		if(remaining === 0) {
			const message = "Please reload data or change filter parameters";
			sendAlertToClient(message, {node: "analyzeStructureSets"});
			return {error: message};
		}

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
	 * @param dir - Directory where to save the compositions
	 * @returns Number of files saved
	 */
	private saveByComposition(dir: string): number {

		let saved = 0;

		for(const entry of this.accumulator.iterateKeys()) {

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
			const fde = openSync(energyFile, "w");

			for(const idx of entry[1]) {

				const structure = this.accumulator.getEntry(idx)!;
				if(!structure?.enabled) continue;

				const comment = "Variable composition by STMng. " +
								`Composition key: ${structure.key}; Step: ${structure.step}; ` +
								`Distance from convex hull: ${structure.distance.toFixed(4)}`;

				writeSync(fd, entryToPoscar(structure, comment));
				writeSync(fde, `${structure.energy?.toFixed(6) ?? "0"}\n`);
			}
			closeSync(fd);
			closeSync(fde);
			++saved;
		}

		return saved;
	}

	/**
	 * Save all compositions in one file
	 *
	 * @param dataFile - Filename for the structure file where to save the compositions
	 */
	private saveAllCompositions(dataFile: string): void {

		const all: [number, number, number][] = [];

		let i = -1;
		for(const entry of this.accumulator.iterateStructures()) {
			++i;
			if(!entry.enabled) continue;
			const energy = entry.energy ?? 0;
			all.push([i, energy, entry.distance]);
		}

		// Order entries by increasing distance from convex hull and then energy
		all.sort((a, b) => {
			const d = a[2] - b[2];
			if(d !== 0) return d;
			const e = a[1] - b[1];
			if(e !== 0) return e;
			return a[0] - b[0];
		});

		const pos = dataFile.lastIndexOf(".");
		const energyFile = pos > 0 ?
									`${dataFile.slice(0, pos)}.energy` :
									`${dataFile}.energy`;

		const fd = openSync(dataFile, "w");
		const fde = openSync(energyFile, "w");

		for(const [idx, energy] of all) {

			const structure = this.accumulator.getEntry(idx)!;
			if(!structure?.enabled) continue;

			const sc1 = `Single component. Step: ${structure.step}; Energy: ${energy.toFixed(4)}`;
			const sc2 = `Composition key: ${structure.key}; Step: ${structure.step}; ` +
						`Distance from convex hull: ${structure.distance.toFixed(4)}`;
			const comment = "Variable composition by STMng. " +
							(structure.key === "1" ? sc1 : sc2);

			writeSync(fd, entryToPoscar(structure, comment));
			writeSync(fde, `${energy.toFixed(6)}\n`);
		}
		closeSync(fd);
		closeSync(fde);
	}

	/**
	 * Compute the convex hull
	 *
	 * @param points - Points in the chart
	 * @returns convex hull vertices and index of the corresponding points
	 */
	private evConvexHull(points: number[][]): [number[], number[], number[]] {

		// Find convex hull (only the lower part)
		// The facet is encoded as (normal[2], offset)
		const hull = quickHull(points);
		const toOrder: {x: number; y: number; idx: number}[] = [];
		for(const facet of hull) {
			if(facet.plane[1] < -1e-4) {
				const [v1, v2] = facet.verts;

				toOrder.push({x: points[v1][0], y: points[v1][1], idx: v1},
							 {x: points[v2][0], y: points[v2][1], idx: v2});
			}
		}

		// Sort convex hull points by increasing x value
		toOrder.sort((a, b) => {
			if(a.x !== b.x) return a.x - b.x;
			return a.y - b.y;
		});

		// Remove duplicated convex hull points
    	const len = toOrder.length;
		const vertexX = [toOrder[0].x];
		const vertexY = [toOrder[0].y];
		const idx     = [toOrder[0].idx];
	    for(let i=0, j=1; j < len; ++j) {
			if(Math.abs(toOrder[i].x-toOrder[j].x) > 1e-4 ||
			   Math.abs(toOrder[i].y-toOrder[j].y) > 1e-4) {
				vertexX.push(toOrder[j].x);
				vertexY.push(toOrder[j].y);
				idx.push(toOrder[j].idx);
				i = j;
			}
		}
		return [vertexX, vertexY, idx];
	}

	/**
	 * Compute distances from the convex hull
	 *
	 * @param lineX - Convex hull vertices X values
	 * @param lineY - Convex hull vertices Y values
	 * @param energy - Points energies
	 * @param volume - Points volumes
	 * @returns Distances of the point from the convex hull
	 */
	private deltaEnergy(lineX: number[], lineY: number[],
						energy: number[], volume: number[]): number[] {

		const nPoints = volume.length;
		const delta = Array<number>(nPoints);
		const len = lineX.length;
		for(let i=0; i < nPoints; ++i) {
			for(let j=0; j < len-1; ++j) {

				if(lineX[j] <= volume[i] && volume[i] <= lineX[j+1]) {

					const t = (volume[i] - lineX[j]) / (lineX[j+1] - lineX[j]);
					delta[i] = energy[i] - (lineY[j] + t * (lineY[j+1] - lineY[j]));
					break;
				}
			}
		}

		return delta;
	}

	// > Channels
	/**
	 * Channel handler for saving results into files in a directory
	 *
	 * @returns Count saved or -1 if not selected
	 */
	private channelSave(params: CtrlParams): CtrlParams {

		const nc = params.componentsCount as number ?? 2;
		if(nc === 0) return {saved: -1};

		if(this.state.consolidateOutput) {
			const file = dialog.showSaveDialogSync({
				title: "Output consolidated structure file",
				defaultPath: "composition-all.poscar",
				filters: [{name: "POSCAR", extensions: ["poscar"]}],
			});
			if(!file) return {saved: -1};

			this.accumulator.initializeKeyMap();

			this.saveAllCompositions(file);

			sendAlertToClient(`Saved consolidated variable composition file ${file}`,
						  	  {level: "success"});

			return {saved: 1};
		}

		const dir = dialog.showOpenDialogSync({
			title: "Output directory",
			properties: ["openDirectory"],
		});
		if(!dir) return {saved: -1};

		this.accumulator.initializeKeyMap();

		const saved = this.saveByComposition(dir[0]);

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

	/**
	 * Channel handler for filtering
	 *
	 * @param params - Filtering parameters
	 * @returns Remaining structures after filtering
	 */
	private channelFilter(params: CtrlParams): CtrlParams {

		this.state.numberComponents = params.numberComponents as number ?? 2;
		this.state.filterStructures = params.filterStructures as boolean ?? true;
        this.state.distanceFromHull = params.distanceFromHull as number ?? 0.15;

		const remaining = this.state.numberComponents === 1 ?
								this.filterOnEnergy() : this.filterStructures();

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
			forceCutoff: params.forceCutoff as boolean ?? true,
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

		return {countEnabled: this.accumulator.enabledCount()};
	}

	/**
	 * Channel handler for analyzing the results of a single composition
	 *
	 * @returns Analysis result status
	 */
	private channelAnalyzeSimple(params: CtrlParams): CtrlParams {

		const summary = [0, 0];
		const resultsKeys: string[] = [];
		const resultsValid: string[] = [];
		const compositionsReduced: string[] = [];

		// No composition
		const compositions = params.compositions as string[];
		if(!compositions?.length) return {

			resultsKeys,
			resultsValid,
			summary,
			compositionsReduced
		};

		// For each selected composition
		for(const composition of compositions) {

			const key = composition.replaceAll("\u2009:\u2009", "-");
			const indices = this.accumulator.getIndicesForKey(key);

			// No composition
			if(!indices?.length) {
				resultsKeys.push(composition);
				resultsValid.push("0");
				continue;
			}

			// One element
			if(indices.length === 1) {
				const entry = this.accumulator.getEntry(indices[0]);
				if(entry === undefined) {
					resultsKeys.push(composition);
					resultsValid.push("0");
					continue;
				}

				const count  = entry.enabled? 1 : 0;
				resultsKeys.push(composition);
				resultsValid.push(count.toString());
				summary[0] += count;
				summary[1] += count;
				continue;
			}

			// Count how many are enabled
			let countEnabled = 0;
			for(const idx of indices) {
				const entry = this.accumulator.getEntry(idx);
				if(entry === undefined) continue;
				if(entry.enabled) ++countEnabled;
			}

			// If one or zero enabled
			if(countEnabled < 2) {
				resultsKeys.push(composition);
				resultsValid.push(countEnabled.toString());
				summary[0] += countEnabled;
				summary[1] += countEnabled;
				continue;
			}

			// Not simple
			compositionsReduced.push(composition);
		}

		return {

			resultsKeys,
			resultsValid,
			summary,
			compositionsReduced
		};
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
		return {status: "OK!", total: count, valid: status.count, key};
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
				height: 950,
				title: "Variable composition 3D convex hull",
				data: this.hull.dataForDisplay3D()
			});
		}
		return {status: "OK!"};
	}

	/**
	 * Channel for showing the EV chart
	 *
	 * @param params - Parameters from the UI
	 * @returns Status
	 */
	private channelEVChart(params: CtrlParams): CtrlParams {

		// Open the chart if so requested
		const showChart = params.showChart as boolean ?? false;
		if(showChart) {

			const energy: number[] = [];
			const volume: number[] = [];
			const step: number[] = [];
			const formula: string[] = [];
			const hullPoints: number[][] = [];

			for(const entry of this.accumulator.iterateEnabledStructures()) {
				energy.push(entry.energy);
				volume.push(entry.volume);
				step.push(entry.step);
				formula.push(entry.formula);
				hullPoints.push([entry.volume, entry.energy]);
			}

			const line = this.evConvexHull(hullPoints);
			const delta = this.deltaEnergy(line[0], line[1], energy, volume);

			const dataToSend = {
				energy,
				volume,
				step,
				formula,
				delta,
				lineX: line[0],
				lineY: line[1],
				idx: line[2]
			};

			createOrUpdateSecondaryWindow({
				routerPath: "/ev-chart",
				width: 1130,
				height: 950,
				title: "Energy-volume chart",
				data: dataToSend
			});
		}
		return {status: "OK!"};
	}

	/**
	 * Channel for showing the Enthalpy transitions
	 *
	 * @param params - Parameters from the UI
	 * @returns Results
	 */
	private channelTransitions(): CtrlParams {

		this.transitionTable = computeTransitions(this.accumulator);
		return {
			steps: this.transitionTable.steps,
			formulas: this.transitionTable.formulas,
			pressures: this.transitionTable.pressures
		};
	}

	/**
	 * Channel for saving the Enthalpy transitions
	 */
	private channelSaveTransitions(): void {

		const file = dialog.showSaveDialogSync({
			title: "Output enthalpy transitions file",
			filters: [{name: "POSCAR", extensions: ["poscar"]}],
		});
		if(!file) return;

		const fd = openSync(file, "w");

		const pos = file.lastIndexOf(".");
		const energyFile = pos > 0 ?
									`${file.slice(0, pos)}.energy` :
									`${file}.energy`;

		const fde = openSync(energyFile, "w");

		const len = this.transitionTable.pressures.length;
		for(let i=0; i < len; ++i) {

			const step = this.transitionTable.steps[i];

			const entry = this.accumulator.getEntryByStep(step);
			if(!entry) continue;

			const p0 = this.transitionTable.pressures[i].toFixed(4);
			const p1 = i === len-1? "up" : this.transitionTable.pressures[i+1].toFixed(4);

			const comment = "Enthalpy transition structures by STMng. " +
				  			`Step: ${entry.step} Pressure range: [${p0}, ${p1}] GPa`;

			writeSync(fd, entryToPoscar(entry, comment));
			writeSync(fde, `${entry.energy.toFixed(6)}\n`);
		}
		closeSync(fd);
		closeSync(fde);

		sendAlertToClient(`Saved enthalpy transition file ${file}`,
						  {level: "success", node: "analyzeStructureSets2"});
	}
}
