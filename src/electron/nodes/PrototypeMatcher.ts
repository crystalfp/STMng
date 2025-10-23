/**
 * Interface to Pymatgen Aflow prototype matcher.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-10-18
 */
import log from "electron-log";
import {NodeCore} from "../modules/NodeCore";
import {sendToClient} from "../modules/ToClient";
import {publicDirPath} from "../modules/GetPublicPath";
import {readFileSync} from "node:fs";
import type {ChannelDefinition, CtrlParams, Structure} from "@/types";
import type {PrototypeEntry} from "../proto/types";
import {findMatchingPrototypes} from "../proto/AflowPrototypeMatcher";

export class PrototypeMatcher extends NodeCore {

	private structure: Structure | undefined;
	private enabled = false;
	private lengthTolerance = 0.2;	// Fractional length tolerance
	private siteTolerance = 0.3;	// Site tolerance
	private angleTolerance = 5;		// Angle tolerance
	private match = "";
	private aflowPrototypesLoaded = false;
	private aflowPrototypeLibrary: PrototypeEntry[] = [];

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

		if(!this.aflowPrototypesLoaded) {
			const sts = this.initializeMatcher();
			if(sts) {
				sendToClient(this.id, "match", {
					error: sts,
					match: ""
				});
				this.aflowPrototypeLibrary.length = 0;
				return;
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.enabled && data?.atoms.length) {
			const sts = this.matchPrototype();
			sendToClient(this.id, "match", sts ? {error: sts, match: ""} : {match: this.match});
		}
		else this.match = "";
	}

	// > Computation
	/**
	 * Initialize the prototype matcher
	 *
	 * @returns On error an error messages, otherwise the empty string
	 */
	private initializeMatcher(): string {

		const filePath = publicDirPath("aflow_prepared_prototypes.json");
		try {
			const aflowPrototypeLibraryRaw = readFileSync(filePath, "utf8");
			this.aflowPrototypeLibrary = JSON.parse(aflowPrototypeLibraryRaw) as PrototypeEntry[];
			if(this.aflowPrototypeLibrary.length === 0) throw Error("No prototypes loaded");
		}
		catch(error: unknown) {
			const message = `Error initializing PrototypeMatcher: ${(error as Error).message}`;
			log.error(message);
			return message;
		}
		return "";
	}

	/**
	 * Do the actual match with the prototypes
	 *
	 * @returns Empty string on success, otherwise error message
	 */
	private matchPrototype(): string {

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
							prototypes.map((entry) => entry.tags.mineral).join("|");
		}
		catch(error: unknown) {
			this.match = "";
			return (error as Error).message;
		}
		return "";
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
			match: this.match
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
					match: ""
				};
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.enabled && this.structure?.atoms.length) {
			const sts = this.matchPrototype();
			if(sts) {
				this.match = "";
				return {error: sts, match: ""};
			}
			return {match: this.match};
		}
		this.match = "";

		return {match: this.match};
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
					match: ""
				};
			}
			this.aflowPrototypesLoaded = true;
		}
		if(this.structure?.atoms.length) {
			const sts = this.matchPrototype();
			if(sts) {
				this.match = "";
				return {error: sts, match: ""};
			}
			return {match: this.match};
		}
		this.match = "";

		return {match: this.match};
	}
}
