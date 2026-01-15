/**
 * Variable composition analysis
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-01-13
 */
import {gcd} from "mathjs";
import {NodeCore} from "../modules/NodeCore";
import {getAtomicSymbol} from "../modules/AtomData";
import {sendAlertToClient, sendToClient} from "../modules/ToClient";
import type {ChannelDefinition, CtrlParams, Structure, Atom} from "@/types";

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

	private readonly speciesRaw = new Set<number>();
	private readonly compositionRaw: Map<number, number>[] = [];
	private species: number[] = [];
	private readonly composition: number[][] = [];
	private enableAnalysis = false;
	private structure: Structure | undefined;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",		type: "invoke",	callback: this.channelInit.bind(this)},
		{name: "reset",     type: "send",   callback: this.channelReset.bind(this)},
		{name: "group",		type: "invoke",	callback: this.channelGroup.bind(this)},
		{name: "capture",	type: "invoke",	callback: this.channelCapture.bind(this)},
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

			this.accumulate(data.atoms);

			// Prepare list of species
			const speciesSymbols: string[] = [];
			for(const atomZ of this.speciesRaw) {
				speciesSymbols.push(getAtomicSymbol(atomZ));
			}

			sendToClient(this.id, "load", {
				countAccumulated: this.compositionRaw.length,
				species: speciesSymbols
			});
		}
	}

	// > Load/save status
	saveStatus(): string {
        const statusToSave = {
			// TBD
		};
        return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		// TBD
		void params;
	}

	// > Compute
	/**
	 * Accumulate the data from a structure
	 *
	 * @param atoms - Structure atoms
	 */
	private accumulate(atoms: Atom[]): void {

		const counts = new Map<number, number>();
		for(const atom of atoms) {
			const {atomZ} = atom;

			const n = counts.get(atomZ);
			counts.set(atomZ, n ? n + 1 : 1);
		}

		this.compositionRaw.push(counts);
		for(const atomZ of counts.keys()) {
			this.speciesRaw.add(atomZ);
		}
	}

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
	 * @param components - The components arranges as [component1, component2,...]
	 * 		where each component is: specie1, specie2, specie3,...
	 * @returns List of possible groups by percentage of each component
	 */
	private fitComposition(ncomponents: number, components: number[]): Recipe[] {

		const nspecies = this.species.length;

		// Find species unique for one component
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
		let stepNumber = 1;
		for(const step of this.composition) {

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

	// > Channel handlers
	/**
	 * Channel handler for UI initialization
	 *
	 * @returns Parameters to initialize the user interface
	 */
	private channelInit(): CtrlParams {

		return {
			species: this.species,
			countAccumulated: this.composition.length,
		};
	}

	/**
	 * Channel handler for clearing the accumulated compositions
	 */
	private channelReset(): void {

		this.speciesRaw.clear();
		this.compositionRaw.length = 0;
	}

	/**
	 * Channel handler for compute compositions
	 *
	 * @returns List of compositions
	 */
	private channelGroup(params: CtrlParams): CtrlParams {

		const ncomponents = params.componentsCount as number ?? 2;
		const components = params.components as number[] ?? [];

		// Normalize data
		const nspecies = this.speciesRaw.size;
		this.species = [...this.speciesRaw];
		this.composition.length = 0;
		for(const step of this.compositionRaw) {

			const entry = Array<number>(nspecies).fill(0);

			for(let i=0; i < nspecies; ++i) {
				const atomZ = this.species[i];
				entry[i] = step.get(atomZ) ?? 0;
			}
			this.composition.push(entry);
		}

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
			this.accumulate(this.structure.atoms);
		}

		// Prepare list of species
		const speciesSymbols: string[] = [];
		for(const atomZ of this.speciesRaw) {
			speciesSymbols.push(getAtomicSymbol(atomZ));
		}
		return {
			countAccumulated: this.compositionRaw.length,
			species: speciesSymbols
		};
	}
}
