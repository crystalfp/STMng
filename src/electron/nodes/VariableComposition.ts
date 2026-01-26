/**
 * Variable composition analysis
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
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


export class VariableComposition extends NodeCore {

	private readonly accumulator = new VariableCompositionAccumulator();
	private enableAnalysis = false;
	private structure: Structure | undefined;
	private state = {
		forceCutoff: false,
		manualCutoffDistance: 10,
		fingerprintingMethod: 0,
		binSize: 0.05,
		peakWidth: 0.02,
		distanceMethod: 0,
		fixTriangleInequality: false,
		removeDuplicates: true,
		duplicatesThreshold: 0.015,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",		 callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   	 callback: this.channelReset.bind(this)},
		{name: "group",		type: "invoke",		 callback: this.channelGroup.bind(this)},
		{name: "capture",	type: "invoke",		 callback: this.channelCapture.bind(this)},
		{name: "save",		type: "invoke",		 callback: this.channelSave.bind(this)},
		{name: "state",		type: "send",		 callback: this.channelState.bind(this)},
		{name: "start",		type: "invoke",		 callback: this.channelStart.bind(this)},
		{name: "analyze",	type: "invokeAsync", callback: this.channelAnalyze.bind(this)},
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
			});
		}
	}

	// > Load/save status
	saveStatus(): string {

		return `"${this.id}": ${JSON.stringify(this.state)}`;
	}

	private initializeState(params: CtrlParams): void {

   		this.state.forceCutoff = params.forceCutoff as boolean ?? false;
    	this.state.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
    	this.state.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
    	this.state.binSize = params.binSize as number ?? 0.05;
    	this.state.peakWidth = params.peakWidth as number ?? 0.02;
    	this.state.distanceMethod = params.distanceMethod as number ?? 0;
    	this.state.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
    	this.state.removeDuplicates = params.removeDuplicates as boolean ?? true;
    	this.state.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
	}

	loadStatus(params: CtrlParams): void {

		this.initializeState(params);
	}

	// > Compute
	/**
	 * Verify step validity
	 *
	 * @param step - Composition of the step to check
	 * @param parts - Computed percentages for each component
	 * @param nspecies - Number of species (is the size of step array)
	 * @param ncomponents - Number of components
	 * @param components - All components
	 * @returns True if the step is the given combination of components
	 */
	private verify(step: number[], parts: number[], nspecies: number,
				   ncomponents: number, components: number[]): boolean {

		for(const part of parts) if(!Number.isInteger(part)) return false;
		for(let i=0; i < nspecies; ++i) {
			let count = 0;
			for(let j=0; j < ncomponents; ++j) {
				count += parts[j] * components[j*nspecies+i];
			}
			if(count !== step[i]) return false;
		}

		return true;
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
		const specials = Array<number>(ncomponents).fill(-1);
		const multiples = Array<number>(ncomponents).fill(0);
		for(let i=0; i < nspecies; ++i) {

			let unique = -1;
			let multiple = 1;
			for(let j=0; j < ncomponents; ++j) {
				const mm = components[nspecies*j+i];
				if(mm !== 0) {
					multiple = mm;
					if(unique === -1) unique = j;
					else {unique = -1; break;}
				}
			}

			if(unique === -1) continue;

			// Which is the specie unique for each component and its multiplicity
			specials[unique] = i;
			multiples[unique] = multiple;
		}
		if(specials.includes(-1)) {

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

			for(let i=0; i < ncomponents; ++i) {
				parts[i] = step[specials[i]]/multiples[i];
			}

			if(!this.verify(step, parts, nspecies, ncomponents, components)) {

				sendAlertToClient(`Invalid composition for step ${stepNumber}`,
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

	private entryToPoscar(entry: VariableComponent): string {

		let out = "Variable composition by STMng. " +
				  `Composition key: ${entry.key}. Step: ${entry.step}\n1.0\n`;

		out += `${entry.basis[0].toFixed(10).padStart(15)} ` +
			   `${entry.basis[1].toFixed(10).padStart(15)} ` +
			   `${entry.basis[2].toFixed(10).padStart(15)}\n`;
		out += `${entry.basis[3].toFixed(10).padStart(15)} ` +
			   `${entry.basis[4].toFixed(10).padStart(15)} ` +
			   `${entry.basis[5].toFixed(10).padStart(15)}\n`;
		out += `${entry.basis[6].toFixed(10).padStart(15)} ` +
			   `${entry.basis[7].toFixed(10).padStart(15)} ` +
			   `${entry.basis[8].toFixed(10).padStart(15)}\n`;

		out += [...entry.species.keys()].map((z) => getAtomicSymbol(z)).join(" ") + "\n";
		out += [...entry.species.values()].map((value) => value.toFixed(0)).join(" ") + "\nDirect\n";

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
	private channelGroup(params: CtrlParams): CtrlParams {

		const ncomponents = params.componentsCount as number ?? 2;
		const components = params.components as number[] ?? [];

		const recipes = this.fitComposition(ncomponents, components);

		return {
			recipes: JSON.stringify(recipes, ["key", "count"]),
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
	 * Channel handler for saving results into files in a directory
	 *
	 * @returns Count saved or -1 if not selected
	 */
	private channelSave(params: CtrlParams): CtrlParams {

		const selectedRaw = params.selected as string[] ?? [];
		if(selectedRaw.length === 0) return {saved: -1};

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

		let saved = 0;
		for(const entry of this.accumulator.iterateKeys()) {

			// If this key has been processed
			if(!selected.has(entry[0])) continue;

			// Check that at least one entry is enabled
			let valid = false;
			for(const idx of entry[1]) {
				if(this.accumulator.getEntry(idx)?.enabled) valid = true;
			}
			if(!valid) continue;

			const name = `composition-${entry[0]}`;
			const dataFile = path.join(dir[0], `${name}.poscar`);
			const energyFile = path.join(dir[0], `${name}.energy`);

			const fd = openSync(dataFile, "w");
			const fde = this.accumulator.hasEnergies() ? openSync(energyFile, "w") : undefined;

			for(const idx of entry[1]) {

				const structure = this.accumulator.getEntry(idx)!;
				if(!structure?.enabled) continue;

				writeSync(fd, this.entryToPoscar(structure));
				if(fde !== undefined) writeSync(fde, `${structure.energy?.toFixed(6) ?? "?"}\n`);
			}
			closeSync(fd);
			if(fde !== undefined) closeSync(fde);
			++saved;
		}

		sendAlertToClient(`Saved ${saved} file${saved === 1 ? "" : "s"} for variable composition`,
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
	 * Channel handler to start analyzing the compositions
	 *
	 * @returns Empty status
	 */
	private channelStart(): CtrlParams {
		this.accumulator.initializeKeyMap();
		return {};
	}

	/**
	 * Channel handler for analyzing the results for a single composition
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
			entry.enabled = true;
			return {status: "OK!", total: 1, valid: 1, key};
		}

		// Do nothing except grouping structures
		if(!params.removeDuplicates) {

			// Enable all entries
			for(const idx of indices) {
				const entry = this.accumulator.getEntry(idx);
				if(entry === undefined) continue;
				entry.enabled = true;
			}

			return {status: "OK!", total: indices.length, valid: indices.length, key};
		}

		// Get and validate parameters
		const options: ComputeValidParameters = {
			method: params.fingerprintingMethod as number ?? 0,
			forceCutoff: params.forceCutoff as boolean ?? false,
			manualCutoffDistance: params.manualCutoffDistance as number ?? 10,
			distanceMethod: params.distanceMethod as number ?? 0,
			binSize: params.binSize as number ?? 0.05,
			peakWidth: params.peakWidth as number ?? 0.02,
			fixTriangleInequality: params.fixTriangleInequality as boolean ?? false,
			duplicatesThreshold: params.duplicatesThreshold as number ?? 0.015,
		};

		if(options.method < 0 || options.method > 2) {
			return {error: "Invalid fingerprinting method", key};
		}
		if(options.forceCutoff && options.manualCutoffDistance <= 0) {
			return {error: "Invalid manual cutoff distance", key};
		}
		if(options.binSize <= 0 || options.peakWidth < 0) {
			return {error: "Invalid fingerprinting parameters", key};
		}
		if(options.distanceMethod < 0 || options.distanceMethod > 2) {
			return {error: "Invalid distance method", key};
		}
		if(options.duplicatesThreshold <= 0) {
			return {error: "Invalid duplicates threshold", key};
		}

		const status = await computeValid(this.accumulator, indices, options);
		if(status.error) return {error: status.error, key};
		if(status.count === 0) return {error: "No valid structures found", key};
		return {status: "OK!", total: indices.length, valid: status.count, key};
	}
}
