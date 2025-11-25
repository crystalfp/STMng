/**
 * Access the aflow prototypes database
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-11-23
 */
import {readFileSync, existsSync, createReadStream} from "node:fs";
import {createGunzip} from "node:zlib";
import {publicDirPath} from "../modules/GetPublicPath";
import {EmptyStructure} from "../modules/EmptyStructure";
import {getAtomicNumber, getAtomData} from "../modules/AtomData";
import type {PrototypeEntry, SNL} from "./types";
import type {DBType, PositionType, PrototypeAtomsData, Structure} from "@/types";

/**
 * getPrototypeStructure return type
 * @notExported
 */
interface PrototypeStructure {
	/** Found mineral tag */
	mineral: string;
	/** Prototype structure */
	structure: Structure;
	/** Error message if any */
	error?: string;
}

/**
 * getPrototypeForDisplay return type
 * @notExported
 */
interface PrototypeDisplay {
	/** Found mineral tag */
	mineral: string;
	/** Prototype lattice matrix */
	matrix: number[][];
	/** Prototype formatted for display */
	atoms: PrototypeAtomsData;
	/** Error message if any */
	error?: string;
}

/**
 * Entries inside the Pymatgen prototypes library file
 * @notExported
 */
interface LibraryEntry {
	/** Prototype structure */
	snl: SNL;
	/** Corresponding tags */
	tags: Record<string, string>;
}

class PrototypeDb {

    private static instance: PrototypeDb;
	private aflowPrototypeLibrary: PrototypeEntry[] = [];
	private readonly aflowAdjunctMap = new Map<string, string>();
	private errorMessage = "";
	private aflowSrcPrototypeLibrary: LibraryEntry[] = [];

	/**
	 * Build the class by loading the prototype data
	 */
	private constructor() {

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
				}
			}
		}
		catch(error: unknown) {
			this.errorMessage = `Error initializing PrototypeDb: ${(error as Error).message}`;
			this.aflowPrototypeLibrary = [];
		}
	}

	/**
	 * Returns error message if any
	 *
	 * @returns The error message or empty string on success
	 */
	getDBError(): string {
		return this.errorMessage;
	}

	/**
	 * Returns the list of preprocessed prototype entries
	 *
	 * @returns The list of preprocessed prototype entries
	 */
	getPreprocessedPrototypes(): PrototypeEntry[] {
		return this.aflowPrototypeLibrary;
	}

	/**
	 * Prepare the list for querying the prototype database
	 *
	 * @returns JSON encoded list of prototypes names and aflow UID
	 */
	async getDBforSearch(): Promise<string> {

		if(this.aflowSrcPrototypeLibrary.length === 0) {
			await this.readCompressedPrototypes();
		}

		const db = new Map<string, string>();
		for(const proto of this.aflowSrcPrototypeLibrary) {

			const mineral = this.aflowAdjunctMap.get(proto.tags.aflow) ?? proto.tags.mineral;
			if(mineral) {

				db.set(mineral, proto.tags.aflow);
				db.set(proto.tags.aflow, "#"+proto.tags.aflow); // Marked to avoid duplicates
			}
			else {

				db.set(proto.tags.aflow, proto.tags.aflow);
			}
		}

		const out: DBType[] = [];
		for(const [k, v] of db) {
			out.push({title: k, aflow: v});
		}

		return JSON.stringify(out.toSorted((a, b) => a.title.localeCompare(b.title)));
	}

	/**
	 * Read the original list of prototypes as provided by Pymatgen
	 */
	private async readCompressedPrototypes(): Promise<void> {

		// Read compressed AFLOW prototypes
		const gunzip = createGunzip();
		const prototypesPath = publicDirPath("aflow_prototypes.json.gz");
		const source = createReadStream(prototypesPath);
		const stream = source.pipe(gunzip);

		let rawResult = "";
		stream.on("data", (chunk: Buffer) => {
			rawResult += chunk.toString("utf8");
		});
		return new Promise<void>((resolve) => {
			stream.on("end", () => {
				// Preprocess AFLOW prototypes
				this.aflowSrcPrototypeLibrary = JSON.parse(rawResult) as LibraryEntry[];
				resolve();
			});
		});
	}

	/**
	 * Get prototype for a given UID formatted for reader
	 *
	 * @param aflow - Aflow UID
	 * @returns Prototype data as ordinary structure (undefined if not found)
	 */
	async getPrototypeStructure(aflow: string): Promise<PrototypeStructure | undefined> {

		if(this.aflowSrcPrototypeLibrary.length === 0) {
			await this.readCompressedPrototypes();
		}

		if(this.errorMessage) {
			return {
				mineral: "",
				structure: new EmptyStructure(),
				error: this.errorMessage
			};
		}

		for(const proto of this.aflowSrcPrototypeLibrary) {

			if(proto.tags.aflow === aflow) {

				const mineral = this.aflowAdjunctMap.get(aflow) ?? proto.tags.mineral;
				return {
					mineral,
					structure: this.snlToStructure(proto.snl)
				};
			}
		}

		return undefined;
	}

	/**
	 * Format aflow prototype as ordinary structure
	 *
	 * @param snl - Prototype structure from the aflow database
	 * @returns Prototype structure as STMng Structure
	 */
	private snlToStructure(snl: SNL): Structure {

		const structure = new EmptyStructure();

		const m = snl.lattice.matrix;
		structure.crystal = {
			basis: [
				m[0][0], m[0][1], m[0][2],
				m[1][0], m[1][1], m[1][2],
				m[2][0], m[2][1], m[2][2]
			],
			origin: [0, 0, 0],
			spaceGroup: ""
		};

		for(const site of snl.sites) {

			const atomZ = getAtomicNumber(site.species[0].element);
			structure.atoms.push({
				atomZ,
				position: site.xyz as PositionType,
				label: site.label,
				chain: ""
			});
		}

		return structure;
	}

	/**
	 * Get prototype for a given UID formatted for display
	 *
	 * @param aflow - Aflow UID
	 * @returns Prototype data for display in secondary window (undefined if not found)
	 */
	async getPrototypeForDisplay(aflow: string): Promise<PrototypeDisplay | undefined> {

		if(this.aflowSrcPrototypeLibrary.length === 0) {
			await this.readCompressedPrototypes();
		}

		if(this.errorMessage) {
			return {
				mineral: "",
				matrix: [],
				atoms: {
					positions: [],
					labels: [],
					radius: [],
					color: []
				},
				error: this.errorMessage
			};
		}

		for(const proto of this.aflowSrcPrototypeLibrary) {

			if(proto.tags.aflow === aflow) {

				const mineral = this.aflowAdjunctMap.get(aflow) ?? proto.tags.mineral;
				return {
					mineral,
					matrix: proto.snl.lattice.matrix,
					atoms: this.extractAtoms(proto.snl)
				};
			}
		}

		return undefined;
	}

	/**
	 * Reformat atom data for rendering
	 *
	 * @param structure - Prototype structure from the aflow library
	 * @returns Atoms data for rendering
	 */
	private extractAtoms(structure: SNL): PrototypeAtomsData {

		const out: PrototypeAtomsData = {
			positions: [],
			labels: [],
			radius: [],
			color: [],
		};

		for(const site of structure.sites) {

			out.positions.push(...site.xyz);
			out.labels.push(site.label);

			const atomZ = getAtomicNumber(site.species[0].element);
			const ad = getAtomData(atomZ);
			out.radius.push(ad.rCov);
			out.color.push(ad.color);
		}

		return out;
	}

	// > Access the singleton instance
	/**
	 * Access the singleton instance
	 *
	 * This is the static method that controls the access to the singleton instance.
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 *
	 * @returns The Atom Data object
	 */
    static getInstance(): PrototypeDb {

        if(!PrototypeDb.instance) {
            PrototypeDb.instance = new PrototypeDb();
        }

        return PrototypeDb.instance;
    }
}

/**
 * Returns error message if any
 *
 * @returns The error message or empty string on success
 */
export const getDBError = (): string => PrototypeDb.getInstance().getDBError();

/**
 * Returns the list of preprocessed prototype entries
 *
 * @returns The list of preprocessed prototype entries
 */
export const getPreprocessedPrototypes = (): PrototypeEntry[] =>
						PrototypeDb.getInstance().getPreprocessedPrototypes();

/**
 * Prepare the list of entries for querying the prototype database
 *
 * @returns JSON encoded list of prototypes names and aflow UID
 */
export const getDBforSearch = async (): Promise<string> =>
						PrototypeDb.getInstance().getDBforSearch();

/**
 * Get prototype for a given UID formatted for reader
 *
 * @param aflow - Aflow UID
 * @returns Prototype data as ordinary structure (undefined if not found)
 */
export const getPrototypeStructure = async (aflow: string): Promise<PrototypeStructure | undefined> =>
						PrototypeDb.getInstance().getPrototypeStructure(aflow);

/**
 * Get prototype for a given UID formatted for display
 *
 * @param aflow - Aflow UID
 * @returns Prototype data for display in secondary window (undefined if not found)
 */
export const getPrototypeForDisplay = async (aflow: string): Promise<PrototypeDisplay | undefined> =>
						PrototypeDb.getInstance().getPrototypeForDisplay(aflow);
