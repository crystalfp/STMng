/**
 * Interface to the structure collection preprocessed database
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-07
 */
import {closeSync, existsSync, openSync, readFileSync, readSync} from "node:fs";
import {getAtomicSymbol} from "./AtomData";
import {EmptyStructure} from "./EmptyStructure";
import {publicDirPath} from "./GetPublicPath";
import type {Structure, Atom} from "@/types";

/**
 * Collection database index entry content
 * @notExported
 */
interface CollectionDbEntry {
	/** User facing structure title */
	title: string;
	/** Start byte of the structure in the db */
	start: number;
}

/**
 * Collection database index file content
 * @notExported
 */
interface CollectionDbIndex {
	/** The structure index */
	index: CollectionDbEntry[];
	/** File format version */
	version: number;
	/** Length of one fingerprint */
	cfpLength: number;
}

/**
 * Index of the collection
 * @notExported
 */
export interface CollectionIndexEntry {
	/** Unique structure identifier */
	id: string;
	/** User facing structure title */
	title: string;
	/** Distance from the given structure  */
	distance?: number;
}

/**
 * Access to the structure collection in binary form
 */
class CollectionDb {

	private static instance: CollectionDb;

	private entries: CollectionDbEntry[] | undefined;
	private readonly dbPrefix: string;
	private countEntries = 0;
	private readonly headerToCheck: Uint8Array;
	private indexFilename = "";
	private dataFilename = "";
	private cfpFilename = "";
	private cfp: Float64Array | undefined;
	private cfpLength = 0;
	private readonly format = 4;

	/**
	 * Initialize the interface to the collection db
	 */
	private constructor() {

		// Filename without extension for the files composing the collection
		// (three files: .idx, .dat, .cfp)
		this.dbPrefix = publicDirPath("structure-collection").replaceAll("\\", "/");

		// Data file magic ("STMng") and file format version (1-255)
		this.headerToCheck = new Uint8Array([83, 84, 77, 110, 103, this.format]);

		// Load the collection files
		this.cacheStructureFiles();
		this.cacheFingerprintFile();
	}

	/**
	 * Cache the collection if not already loaded
	 *
	 * @throws Error.
	 * "Collection database not found" or "Corrupted collection database" or
	 * "Collection database format invalid" or "Collection database not loaded"
	 */
	private cacheStructureFiles(): void {

		// If already loaded do nothing
		if(this.entries?.length &&
		   this.countEntries === this.entries.length) return;

		// Save the filenames
		this.dataFilename = `${this.dbPrefix}.dat`;
		this.indexFilename = `${this.dbPrefix}.idx`;

		// Check the files exist
		if(!existsSync(this.indexFilename) || !existsSync(this.dataFilename)) {
			throw Error("Collection database not found");
		}

		// Check the binary file magic number and revision
		const fd = openSync(this.dataFilename, "r");
		const header = new Uint8Array(6);
		readSync(fd, header, 0, 6, 0);
		closeSync(fd);
		if(header[5] !== this.headerToCheck[5]) {
			throw Error(`Collection database invalid: file format ${header[5]} instead of ${this.headerToCheck[5]}`);
		}
		if(!header.every((value, index) => value === this.headerToCheck[index])) {
			throw Error("Corrupted collection database");
		}

		const content = readFileSync(this.indexFilename, "utf8");
		const db = JSON.parse(content) as CollectionDbIndex;
		if(db.version !== this.format) {
			throw Error(`Collection database invalid: file format ${db.version} instead of ${this.format}`);
		}

		this.entries = db.index;
		this.countEntries = this.entries.length;
		this.cfpLength = db.cfpLength;
	}

	/**
	 * Cache the fingerprints if not already loaded
	 */
	private cacheFingerprintFile(): void {

		// If already loaded do nothing
		if(this.cfp && this.countEntries && this.cfp.length > 0) return;

		this.cfpFilename = `${this.dbPrefix}.cfp`;
		if(!existsSync(this.cfpFilename)) {
			throw Error("Fingerprints file for collection database not found");
		}

		const fd = openSync(this.cfpFilename, "r");
		this.cfp = new Float64Array(this.countEntries*this.cfpLength);
		const bytes = readSync(fd, this.cfp);
		closeSync(fd);

		if(bytes === 0) throw Error("Collection fingerprints not loaded");
		if(this.cfp.length !== this.countEntries*this.cfpLength) {
			const n = this.cfp.BYTES_PER_ELEMENT;
			throw Error(`Fingerprint file size ${this.cfp.length*n} ` +
						" is not a multiple of the number of entries " +
						this.countEntries*this.cfpLength*n);
		}
	}

	/**
	 * Load the collection and return the index
	 *
	 * @returns Array of db index entries
	 * @throws Error.
	 * "Collection database not found" or "Corrupted collection database" or
	 * "Collection database format invalid" or "Collection database not loaded"
	 */
	loadList(): CollectionIndexEntry[] {

		const out: CollectionIndexEntry[] = [];
		for(let i=0; i < this.countEntries; ++i) {
			out.push({
				id: i.toString(),
				title: this.entries![i].title
			});
		}

		return out;
	}

	/**
	 * Get the collection structure with the given ID
	 *
	 * @param id - ID of the collection entry to access
	 * @returns The collection structure or undefined if not found
	 * @throws Error.
	 * "Collection database not loaded"
	 */
	getStructure(id: string): Structure | undefined {

		const idx = Number.parseInt(id, 10);
		if(Number.isNaN(idx) || idx < 0 || idx >= this.countEntries) return undefined;
		const entry = this.entries![idx];
		if(!entry) return undefined;
		const {start} = entry;

		const structure = new EmptyStructure();

		const fd = openSync(this.dataFilename, "r");
		const natomsBuffer = new Uint8Array(2);
		readSync(fd, natomsBuffer, 0, 2, start);
		const natoms = natomsBuffer[1]*256+natomsBuffer[0];
		const atomsZBuffer = new Uint8Array(natoms);
		readSync(fd, atomsZBuffer, 0, natoms, start+2);
		const floatPart = new Float32Array(9+natoms*3);
		const floatLength = floatPart.byteLength;
		readSync(fd, floatPart, 0, floatLength, start+2+natoms);
		for(let i=0; i < 9; ++i) {
			structure.crystal.basis[i] = floatPart[i];
		}
		for(let i=0, j=9; i < natoms; ++i) {
			const atom: Atom = {
				atomZ: atomsZBuffer[i],
				label: getAtomicSymbol(atomsZBuffer[i]),
				chain: "",
				position: [
					floatPart[j++],
					floatPart[j++],
					floatPart[j++]
				]
			};
			structure.atoms.push(atom);
		}

		closeSync(fd);

		return structure;
	}

	/**
	 * Compute the cosine distance between two fingerprints
	 *
	 * @param fp - Fingerprint to test
	 * @param idx - Index in the loaded structures fingerprints
	 * @returns Cosine distance between the two fingerprints
	 */
	private computeFpDistance(fp: Float64Array, idx: number): number {

		let distance = 0;
		let aNorm = 0;
		let bNorm = 0;
		for(let i=0; i < this.cfpLength; ++i) {

			const fp2 = this.cfp![idx*this.cfpLength+i];
			distance += fp[i] * fp2;
			aNorm    += fp[i] * fp[i];
			bNorm    += fp2 * fp2;
		}

		distance /= Math.sqrt(aNorm*bNorm);
		return (1 - distance)/2;
	}

	/**
	 * Get structures near the given one
	 *
	 * @param fp - Fingerprint to test
	 * @param n - Number of nearest structures to return
	 * @returns List of nearest structures id, title and distance
	 */
	getNearestStructures(fp: Float64Array, n=1): CollectionIndexEntry[] {

		if(n < 1) n = 1;
		if(fp.length !== this.cfpLength) return [];

		const candidates = new Map<number, number[]>();

		for(let i=0; i < this.countEntries; ++i) {

			// Check if this is an excluded file
			if(this.cfp![i*this.cfpLength] < -1) continue;

			// Compute distance
			const dist = this.computeFpDistance(fp, i);

			// Group by distances
			const key = dist === 0 || Object.is(dist, -0) ? 0 : Math.round(dist*1000);
			if(candidates.has(key)) candidates.get(key)!.push(i);
			else candidates.set(key, [i]);
		}

		const out: CollectionIndexEntry[] = [];
		const keys = [...candidates.keys()].toSorted((a, b) => a-b).slice(0, n);
		for(const key of keys) {
			const result = candidates.get(key)!;
			const distance = key/1000;
			for(const idx of result) {
				out.push({
					id: idx.toString(),
					title: this.entries![idx].title,
					distance
				});
			}
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
	 * @returns The CollectionDb object
	 */
    static getInstance(): CollectionDb {

        if(!CollectionDb.instance) {
            CollectionDb.instance = new CollectionDb();
        }

        return CollectionDb.instance;
    }
}

/**
 * Get structures near the given one
 *
 * @param fp - Fingerprint to test
 * @param n - Number of nearest structures to return
 * @returns List of nearest structures id, title and distance
 */
export const collectionGetNearestStructures = (fp: Float64Array,
											   n=1): CollectionIndexEntry[] =>
	CollectionDb.getInstance().getNearestStructures(fp, n);

/**
 * Load the collection and return the index
 *
 * @returns Array of db index entries
 * @throws Error.
 * "Collection database not found" or "Corrupted collection database" or
 * "Collection database format invalid" or "Collection database not loaded"
 */
export const collectionLoadList = (): CollectionIndexEntry[] =>
	CollectionDb.getInstance().loadList();

/**
 * Get the collection structure with the given ID
 *
 * @param id - ID of the collection entry to access
 * @returns The collection structure or undefined if not found
 * @throws Error.
 * "Collection database not loaded"
 */
export const collectionGetStructure = (id: string): Structure | undefined =>
	CollectionDb.getInstance().getStructure(id);
