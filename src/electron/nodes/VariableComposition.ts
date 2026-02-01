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
import {createOrUpdateSecondaryWindow2} from "../modules/WindowsUtilities";
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

// Useful constants
const C1 = 1/Math.sqrt(3);
const C2 = (Math.sqrt(3)-1)/2;

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
		duplicatesThreshold: 0.015,
		removeDuplicates: true,
	};

	private readonly channels: ChannelDefinition[] = [
		{name: "init",			type: "invoke",		 callback: this.channelInit.bind(this)},
		{name: "reset",     	type: "send",   	 callback: this.channelReset.bind(this)},
		{name: "group",			type: "invoke",		 callback: this.channelGroup.bind(this)},
		{name: "capture",		type: "invoke",		 callback: this.channelCapture.bind(this)},
		{name: "save",			type: "invoke",		 callback: this.channelSave.bind(this)},
		{name: "state",			type: "send",		 callback: this.channelState.bind(this)},
		{name: "start",			type: "invoke",		 callback: this.channelStart.bind(this)},
		{name: "analyze",		type: "invokeAsync", callback: this.channelAnalyze.bind(this)},
		{name: "convex-hull",	type: "invoke",		 callback: this.channelConvexHull.bind(this)},
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

   		this.state.forceCutoff = params.forceCutoff as boolean ?? false;
    	this.state.manualCutoffDistance = params.manualCutoffDistance as number ?? 10;
    	this.state.fingerprintingMethod = params.fingerprintingMethod as number ?? 0;
    	this.state.binSize = params.binSize as number ?? 0.05;
    	this.state.peakWidth = params.peakWidth as number ?? 0.02;
    	this.state.distanceMethod = params.distanceMethod as number ?? 0;
    	this.state.fixTriangleInequality = params.fixTriangleInequality as boolean ?? false;
    	this.state.removeDuplicates = params.removeDuplicates as boolean ?? true;
    	this.state.duplicatesThreshold = params.duplicatesThreshold as number ?? 0.015;
		this.state.consolidateOutput = params.consolidateOutput as boolean ?? false;
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
			entry.position = this.computePositionFromParts(parts);

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
	 * Return chart coordinates
	 * Depends on number of components:
	 * 	2: proportion of the components as x value
	 *  3: x and y values inside a triangular chart
	 *  4: not implemented yet
	 * @param parts - Composition of a given structure
	 * @returns Array of (parts-1) coordinates
	 */
	private computePositionFromParts(parts: number[]): number[] {

		switch(parts.length) {
			case 2:
				return [parts[1]/(parts[0]+parts[1])];
			case 3: {
				const a = parts[1]/(parts[0]+parts[1]);
				const c = parts[2]/(parts[0]+parts[2]);
				return [a, a*C1+c*C2];
			}
			default:
				 // TBD
				return Array<number>(parts.length-1).fill(0);
		}
	}

	/**
	 * Format entry as POSCAR file
	 *
	 * @param entry - One composition to convert to POSCAR
	 * @returns Content of the POSCAR file
	 */
	private entryToPoscar(entry: VariableComponent): string {

		let out = "Variable composition by STMng. " +
				  `Composition key: ${entry.key}. Step: ${entry.step}\n1.0\n`;

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
			let valid = false;
			for(const idx of entry[1]) {
				if(this.accumulator.getEntry(idx)?.enabled) {
					valid = true;
					break;
				}
			}
			if(!valid) continue;

			// TBD Order by distance from convex hull
			// Order entries by increasing energies
			if(hasEnergies) {

				const toOrder = [];
				for(const idx of entry[1]) {
					const structure = this.accumulator.getEntry(idx);
					toOrder.push([structure!.energy!, idx]);
				}
				entry[1] = toOrder
								.toSorted((a, b) => a[0] - b[0])
								.map((value) => value[1]);
			}

			const name = `composition-${entry[0]}`;
			const dataFile = path.join(dir, `${name}.poscar`);
			const energyFile = path.join(dir, `${name}.energy`);

			const fd = openSync(dataFile, "w");
			const fde = hasEnergies ? openSync(energyFile, "w") : undefined;

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
		const all: [number, number][] = [];

		for(const entry of this.accumulator.iterateKeys()) {

			// If this key has been processed
			if(!selected.has(entry[0])) continue;

			// Check that at least one entry is enabled
			let valid = false;
			for(const idx of entry[1]) {
				if(this.accumulator.getEntry(idx)?.enabled) {
					valid = true;
					break;
				}
			}
			if(!valid) continue;

			// TBD Order by distance from convex hull
			// Order entries by increasing energies
			if(hasEnergies) {

				for(const idx of entry[1]) {
					const structure = this.accumulator.getEntry(idx);
					all.push([structure!.energy!, idx]);
				}
			}
			else {
				for(const idx of entry[1]) {
					all.push([0, idx]);
				}
			}
		}

		if(hasEnergies) all.sort((a, b) => {
			const d = a[0] - b[0];
			if(d !== 0) return d;
			return a[1] - b[1];
		});
		else all.sort((a, b) => a[1]-b[1]);

		const name = "composition-all";
		const dataFile = path.join(dir, `${name}.poscar`);
		const energyFile = path.join(dir, `${name}.energy`);

		const fd = openSync(dataFile, "w");
		const fde = hasEnergies ? openSync(energyFile, "w") : undefined;

		for(const one of all) {

			const structure = this.accumulator.getEntry(one[1])!;
			if(!structure?.enabled) continue;

			writeSync(fd, this.entryToPoscar(structure));
			if(fde !== undefined) writeSync(fde, `${one[0].toFixed(6)}\n`);
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
			duplicatesThreshold: params.duplicatesThreshold as number ?? 0.015,
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
			entry.enabled = true;
			return {status: "OK!", total: 1, valid: 1, key};
		}

		// Do nothing except grouping structures
		if(!this.options.removeDuplicates) {

			// Enable all entries
			this.accumulator.setEnableStatus(indices, true);

			return {status: "OK!", total: indices.length, valid: indices.length, key};
		}

		const status = await computeValid(this.accumulator, indices, this.options);
		if(status.error) return {error: status.error, key};
		if(status.count === 0) return {error: "No valid structures found", key};
		return {status: "OK!", total: indices.length, valid: status.count, key};
	}

	/**
	 * Distances of 2D points from the convex hull line
	 *
	 * @param x - Points X coordinates
	 * @param y - Points Y coordinates
	 * @param vertices - Vertices of the convex hull line
	 * @returns Distances of the points from the line
	 */
	private distanceFromConvexHull(x: number[], y: number[], vertices: number[]): number[] {

		const distances = Array<number>(x.length).fill(0);

		for(let i=0; i < x.length; ++i) {

			const xx = x[i];
			for(let j=2; j < vertices.length; j+=2) {
				if(vertices[j] >= xx) {
					const m = (vertices[j+1]-vertices[j-1])/(vertices[j]-vertices[j-2]);
					const yl = (xx-vertices[j-2])*m+vertices[j-1];
					distances[i] = y[i]-yl;
					break;
				}
			}
		}

		return distances;
	}

	/**
	 * Prepare data for visualization of the 2 components convex hull
	 *
	 * @returns Params to be passed to the client for visualization
	 */
	private prepareDim2Data(): CtrlParams {

		// Find extremes
		let y0 = Number.POSITIVE_INFINITY;
		let y1 = Number.POSITIVE_INFINITY;

		const x: number[] = [];
		const y: number[] = [];
		const step: number[] = [];
		const parts: string[] = [];
		for(const structure of this.accumulator.iterateStructures()) {

			if(!structure.enabled) continue;
			const energy = structure.energy!;
			x.push(structure.position[0]);
			y.push(energy);
			step.push(structure.step);
			parts.push(structure.key);
			if(structure.parts[0] === 1 &&
			   structure.parts[1] === 0 &&
			   energy < y0) {
				y0 = energy;
			}
			else if(structure.parts[0] === 0 &&
				    structure.parts[1] === 1 &&
					energy < y1) {
						y1 = energy;
			}
		}

		// Find enthalpy of formation
		let len = x.length;
		for(let i=0; i < len; ++i) y[i] -= y0+x[i]*(y1-y0);

		// Find convex hull (only the lower part)
		const points: number[][] = [];
		for(let i=0; i < len; ++i) points.push([x[i], y[i]]);
		const hull = quickHull(points);
		const toOrder: {x: number; y: number; idx: number}[] = [];
		for(const facet of hull) {
			if(facet.plane[1] < 0) {
				const v1 = facet.verts[0];
				const v2 = facet.verts[1];

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
    	len = toOrder.length;
		const vertices: number[] = [toOrder[0].x, toOrder[0].y];
		const idxVertices = [toOrder[0].idx];
	    for(let i=0, j=1; j < len; ++j) {
			if(Math.abs(toOrder[i].x-toOrder[j].x) > 1e-4 ||
			   Math.abs(toOrder[i].y-toOrder[j].y) > 1e-4) {
				vertices.push(toOrder[j].x, toOrder[j].y);
				idxVertices.push(toOrder[j].idx);
				i = j;
			}
		}

		// Add distances from the convex hull
		const distance = this.distanceFromConvexHull(x, y, vertices);

		return {
			dimension: 2,
			x,
			y,
			step,
			parts,
			vertices,
			idxVertices,
			distance
		};
	}

	/**
	 * Prepare data for visualization of the 3 components convex hull
	 *
	 * @returns Params to be passed to the client for visualization
	 */
	private prepareDim3Data(): CtrlParams {

		// Find extremes
		let y0 = Number.POSITIVE_INFINITY;
		let y1 = Number.POSITIVE_INFINITY;
		let y2 = Number.POSITIVE_INFINITY;
		let d0 = 0;
		let d1 = 0;
		let d2 = 0;

		let idx = 0;
		const x: number[] = [];
		const y: number[] = [];
		const z: number[] = [];
		const d: number[] = [];
		for(const structure of this.accumulator.iterateStructures()) {
			++idx;
			if(!structure.enabled) continue;
			const energy = structure.energy!;
			x.push(structure.position[0]);
			y.push(structure.position[1]);
			z.push(energy);
			d.push(idx);
			if(structure.parts[0] === 1 &&
			   structure.parts[1] === 0 &&
			   structure.parts[2] === 0 &&
			   energy < y0) {
				y0 = energy;
				d0 = idx;
			}
			else if(structure.parts[0] === 0 &&
				    structure.parts[1] === 1 &&
				    structure.parts[2] === 0 &&
					energy < y1) {
						y1 = energy;
						d1 = idx;
			}
			else if(structure.parts[0] === 0 &&
				    structure.parts[1] === 0 &&
				    structure.parts[2] === 1 &&
					energy < y2) {
						y2 = energy;
						d2 = idx;
			}
		}

		// TBD
		return {
			dimension: 3,
			x, y, z, d,
			y0,
			d0,
			y1,
			d1,
			y2,
			d2
		};
	}

	/**
	 * Prepare data for visualization of the 4 components convex hull
	 *
	 * @returns Params to be passed to the client for visualization
	 */
	private prepareDim4Data(): CtrlParams {

		// Find extremes
		let y0 = Number.POSITIVE_INFINITY;
		let y1 = Number.POSITIVE_INFINITY;
		let y2 = Number.POSITIVE_INFINITY;
		let d0 = 0;
		let d1 = 0;
		let d2 = 0;

		let idx = 0;
		const x: number[] = [];
		const y: number[] = [];
		const z: number[] = [];
		const d: number[] = [];
		for(const structure of this.accumulator.iterateStructures()) {
			++idx;
			if(!structure.enabled) continue;
			const energy = structure.energy!;
			x.push(structure.position[0]);
			y.push(structure.position[1]);
			z.push(energy);
			d.push(idx);
			if(structure.parts[0] === 1 &&
			   structure.parts[1] === 0 &&
			   structure.parts[2] === 0 &&
			   energy < y0) {
				y0 = energy;
				d0 = idx;
			}
			else if(structure.parts[0] === 0 &&
				    structure.parts[1] === 1 &&
				    structure.parts[2] === 0 &&
					energy < y1) {
						y1 = energy;
						d1 = idx;
			}
			else if(structure.parts[0] === 0 &&
				    structure.parts[1] === 0 &&
				    structure.parts[2] === 1 &&
					energy < y2) {
						y2 = energy;
						d2 = idx;
			}
		}

		// TBD
		return {
			dimension: 4,
			x, y, z, d,
			y0,
			d0,
			y1,
			d1,
			y2,
			d2
		};
	}

	/**
	 * Channel handler to start analyzing the compositions
	 *
	 * @returns Error message or empty on success
	 */
	private channelConvexHull(params: CtrlParams): CtrlParams {

		const showChart = params.showChart as boolean ?? false;
		const dimension = params.dimension as number ?? 2;

		let result: CtrlParams = {};
		switch(dimension) {
			case 2:
				result = this.prepareDim2Data();
				break;
			case 3:
				result = this.prepareDim3Data();
				break;
			case 4:
				result = this.prepareDim4Data();
				break;
			default:
				return {error: "Invalid dimension"};
		}

		// Open the chart if so requested
		if(showChart) {

			createOrUpdateSecondaryWindow2({
				routerPath: "/components-hull",
				width: 1600,
				height: 900,
				title: "Variable composition convex hull",
				data: result
			});
		}
		return {status: "OK!"};
	}
}
