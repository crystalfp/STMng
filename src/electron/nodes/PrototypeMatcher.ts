/**
 * Interface to Pymatgen Aflow prototype matcher.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-18
 */
import {existsSync, readFileSync} from "node:fs";
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import {sendToClient} from "../modules/ToClient";
import {publicDirPath} from "../modules/GetPublicPath";
import {findMatchingPrototypes} from "../proto/AflowPrototypeMatcher";
import {getAtomicSymbol} from "../modules/AtomData";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";
import type {PrototypeEntry, Prototype} from "../proto/types";

export class PrototypeMatcher extends NodeCore {

	private structure: Structure | undefined;
	private enabled = false;
	private lengthTolerance = 0.2;	// Fractional length tolerance
	private siteTolerance = 0.3;	// Site tolerance
	private angleTolerance = 5;		// Angle tolerance
	private match = "";
	private formula = "";
	private hasInput = false;
	private aflowPrototypesLoaded = false;
	private aflowPrototypeLibrary: PrototypeEntry[] = [];
	private readonly aflowAdjunctMap = new Map<string, string>();
	private hasAdjunctMap = false;

	private readonly channels: ChannelDefinition[] = [
		{name: "init",       type: "invoke", callback: this.channelInit.bind(this)},
		{name: "enable",	 type: "invoke", callback: this.channelEnable.bind(this)},
		{name: "tolerances", type: "invoke", callback: this.channelTolerances.bind(this)},
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

		const statusToSave = {
			enabled: this.enabled,
			lengthTolerance: this.lengthTolerance,
			siteTolerance: this.siteTolerance,
			angleTolerance: this.angleTolerance,
		};
        return `"${this.id}":${JSON.stringify(statusToSave)}`;
	}

	loadStatus(params: CtrlParams): void {

		this.enabled = params.enabled as boolean ?? false;
		this.lengthTolerance = params.lengthTolerance as number ?? 0.2;
		this.siteTolerance = params.siteTolerance as number ?? 0.3;
		this.angleTolerance = params.angleTolerance as number ?? 5;
	}

	override fromPreviousNode(data: Structure): void {

		this.structure = data;

		this.hasInput = data && data.atoms.length > 0;
		this.formula = this.hasInput ? this.getChemicalFormula(this.structure) : "";

		if(!this.aflowPrototypesLoaded) {
			const sts = this.initializeMatcher();
			if(sts) {
				sendToClient(this.id, "match", {
					error: sts,
					match: "",
					formula: this.formula,
					hasInput: this.hasInput
				});
				this.aflowPrototypeLibrary.length = 0;
				return;
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.enabled && this.hasInput) {
			const sts = this.matchPrototype();
			const params: CtrlParams = sts ?
											{
												error: sts,
												match: "",
												formula: this.formula,
												hasInput: this.hasInput
											} : {
												match: this.match,
												formula: this.formula,
												hasInput: this.hasInput
											};
			sendToClient(this.id, "match", params);
		}
		else {
			this.match = "";
		}
	}

	// > Computation
	/**
	 * Initialize the prototype matcher
	 *
	 * @remarks The data file is obtained running the Python library and capturing the `self._aflow_prototype_library` list from the AflowPrototypeMatcher class constructor
	 *
	 * @returns On error an error messages, otherwise the empty string
	 */
	private initializeMatcher(): string {

		const filePath = publicDirPath("aflow_prepared_prototypes.json");
		const adjunctPath = publicDirPath("mineral_overrides.json");
		try {
			const aflowPrototypeLibraryRaw = readFileSync(filePath, "utf8");
			this.aflowPrototypeLibrary = JSON.parse(aflowPrototypeLibraryRaw) as PrototypeEntry[];
			if(this.aflowPrototypeLibrary.length === 0) throw Error("No prototypes loaded");

			if(existsSync(adjunctPath)) {
				const adjunctRaw = readFileSync(adjunctPath, "utf8");
				if(adjunctRaw) {
					const adjunct = JSON.parse(adjunctRaw) as Record<string, string>;
					for(const entry in adjunct) this.aflowAdjunctMap.set(entry, adjunct[entry]);
					this.hasAdjunctMap = true;
				}
			}
		}
		catch(error: unknown) {
			const message = `Error initializing PrototypeMatcher: ${(error as Error).message}`;
			log.error(message);
			return message;
		}
		return "";
	}

	/**
	 * Retrieve the correct tag to be shown
	 *
	 * @remarks The prototype data is composed by, for example:
	 * 'pearson': 'cF8',
	 * 'aflow': 'AB_cF8_216_c_a',
	 * 'strukturbericht': 'B3',
	 * 'mineral': 'Zincblende, Sphalerite'
	 *
	 * @param entry - One resulting prototype
	 * @returns The tag to be shown
	 */
	private getTag(entry: Prototype): string {

		if(this.hasAdjunctMap) {
			const mineral =  this.aflowAdjunctMap.get(entry.tags.aflow);
			if(mineral) return mineral;
		}
		if(entry.tags.mineral) return entry.tags.mineral;
		return `Aflow UID: ${entry.tags.aflow ?? "???"}`;
	}

	/**
	 * Do the actual match with the prototypes
	 *
	 * @returns Empty string on success, otherwise error message
	 */
	private matchPrototype(): string {

		this.match = "";
		if(!this.structure || this.aflowPrototypeLibrary.length === 0) return "";

		try {
			const prototypes = findMatchingPrototypes(
				this.structure,
				this.aflowPrototypeLibrary,
				this.lengthTolerance,
				this.siteTolerance,
				this.angleTolerance
			);

			// Return the multiple matches separated by a "|"
			this.match = prototypes.length === 0 ?
							"" :
							prototypes.map((entry) => this.getTag(entry)).join("|");
		}
		catch(error: unknown) {
			return (error as Error).message;
		}
		return "";
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
			enabled: this.enabled,
			lengthTolerance: this.lengthTolerance,
			siteTolerance: this.siteTolerance,
			angleTolerance: this.angleTolerance,
			match: this.match,
			formula: this.formula,
			hasInput: this.hasInput
		};
	}

	/**
	 * Channel handler for enabling the prototype matcher
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelEnable(params: CtrlParams): CtrlParams {

		this.enabled = params.enabled as boolean ?? false;

		if(!this.aflowPrototypesLoaded) {
			const sts = this.initializeMatcher();
			if(sts) {
				this.aflowPrototypeLibrary.length = 0;
				return {
					error: sts,
					match: "",
					formula: this.formula,
					hasInput: this.hasInput
				};
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.enabled && this.structure?.atoms.length) {
			const sts = this.matchPrototype();
			if(sts) {
				this.match = "";
				return {error: sts, match: "", formula: "", hasInput: this.hasInput};
			}
			return {match: this.match, formula: this.formula, hasInput: this.hasInput};
		}
		this.match = "";

		return {match: this.match, formula: this.formula, hasInput: this.hasInput};
	}

	/**
	 * Channel handler for changing computational parameters
	 *
	 * @param params - Params from the client
	 * @returns Params with the operation status
	 */
	private channelTolerances(params: CtrlParams): CtrlParams {

		if(!this.enabled) return {match: this.match};

		this.lengthTolerance = params.lengthTolerance as number ?? 0.2;
		this.siteTolerance = params.siteTolerance as number ?? 0.3;
		this.angleTolerance = params.angleTolerance as number ?? 5;

		if(!this.aflowPrototypesLoaded) {
			const sts = this.initializeMatcher();
			if(sts) {
				this.aflowPrototypeLibrary.length = 0;
				return {
					error: sts,
					match: "",
					formula: this.formula,
					hasInput: this.hasInput
				};
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.structure?.atoms.length) {
			const sts = this.matchPrototype();
			if(sts) {
				this.match = "";
				return {error: sts, match: "", formula: "", hasInput: this.hasInput};
			}
			return {match: this.match, formula: this.formula, hasInput: this.hasInput};
		}
		this.match = "";

		return {match: this.match, formula: this.formula, hasInput: this.hasInput};
	}
}
