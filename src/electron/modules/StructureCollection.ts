/**
 * Access structures from the Collection and from the Prototypes lists
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-10-13
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
import type {Atom, Structure, CollectionsEntryType} from "@/types";
import {publicDirPath} from "./GetPublicPath";
import {existsSync, openSync, readSync, closeSync, readFileSync} from "node:fs";
import {getAtomicSymbol} from "./AtomData";
import {EmptyStructure} from "./EmptyStructure";
import type {CollectionIndexEntry} from "./CollectionDb";


interface CollectionList {
	/** User facing structure title */
	title: string;
	/** Start byte of the structure in the db */
	start: number;
	/** Fingerprint index */
	fpIdx: number;
}

interface PrototypesAdd {
	/** Aflow UID (mandatory for the prototypes entries) */
	aflow: string;
	/** Pearson code (optional for the prototypes entries) */
	pearson?: string;
	/** Strukturbericht code (optional for the prototypes entries) */
	strukturbericht?: string;
}

type CollectionsEntry = CollectionList & (
	{
		proto: false;
	} |
	({
		proto: true;
	} & PrototypesAdd
));

/**
 * Collection database index file content
 * @notExported
 */
interface CollectionsIndex {
	/** The structure index */
	index: CollectionsEntry[];
	/** File format version */
	version: number;
	/** Length of one fingerprint */
	cfpLength: number;
}

/**
 * prototypeGetStructure return type
 * @notExported
 */
interface PrototypeStructure {

	/** Pearson symbol */
	pearson: string;
	/** AFLOW identifier (UID) */
	aflow: string;
	/** A detailed crystal structure classification by analogy to another known structure */
	strukturbericht: string;
	/** Prototype mineral/component name */
	mineral: string;
	/** Prototype structure */
	structure: Structure;
}

interface PrototypeIndex {
	/** Offset to the structure data in the .dat binary file */
	positionStructure: number;
	/** Pearson symbol */
	pearson: string;
	/** A detailed crystal structure classification by analogy to another known structure */
	strukturbericht: string;
	/** Prototype mineral/component name */
	mineral: string;
}

interface CollectionStructure {

	/** Collection element mineral/component name */
	mineral: string;
	/** Collection structure */
	structure: Structure;
}

interface CollectionIndex {
	/** Offset to the structure data in the .dat binary file */
	positionStructure: number;
	/** Prototype mineral/component name */
	mineral: string;
}

/**
 * Index of the collection
 */
export interface CollectionsIndexEntry {
	/** Unique structure identifier */
	id: string;
	/** User facing structure title */
	title: string;
	/** Distance from the given structure  */
	distance?: number;
	/** Color classification of the distance */
	color?: string;
}

interface QueueEntry {
	distance: number;
	idx: number;
}

class DistancesQueue {

	private readonly entries: QueueEntry[];
	private readonly size: number;

	constructor(length: number) {
		this.size = Math.max(length, 1);
		this.entries = Array<QueueEntry>(this.size);
		for(const entry of this.entries) entry.distance = Number.POSITIVE_INFINITY;
	}

	enqueue(distance: number, idx: number): void {

		if(this.size === 1) {
			if(this.entries[0].distance > distance) {
				this.entries[0].distance = distance;
				this.entries[0].idx = idx;
			}
		}
		else {

			for(let i=0; i < this.size; ++i) {

				if(this.entries[i].distance >= distance) {
					for(let j=this.size-2; j>=i; --j) {
						this.entries[j+1] = this.entries[j];
					}
					this.entries[i].distance = distance;
					this.entries[i].idx = idx;
					break;
				}
			}
		}
	}

	dump(): QueueEntry[] {

		for(let i=0; i < this.size; ++i) {
			if(this.entries[i].distance === Number.POSITIVE_INFINITY) {
				this.entries.length = i+1;
				break;
			}
		}

		return this.entries;
	}
}

class StructureCollection {

	private static instance: StructureCollection;

	private readonly cfpLength: number = 0;
	private readonly format = 3;
	private readonly entries: CollectionsEntry[] | undefined;
	private readonly dbPrefix: string;
	private readonly countEntries: number;
	private readonly headerToCheck: Uint8Array;
	private readonly indexFilename: string;
	private readonly dataFilename: string;
	private readonly cfpFilename: string;
	private cfp: Float64Array | undefined;
	private readonly mapCfp = new Map<number, number[]>();

	private readonly prototypeMap = new Map<string, PrototypeIndex>();
	private readonly collectionMap = new Map<number, CollectionIndex>();

	/**
	 * Initialize the interface to the structure collection
	 */
	private constructor() {

		// Filename without extension for the files composing the collection
		// (three files: .idx, .dat, .cfp) TEMPORARY as *2
		this.dbPrefix = publicDirPath("structure-collection2").replaceAll("\\", "/");

		// Data file magic ("STMng") and file format version (1-255)
		this.headerToCheck = new Uint8Array([83, 84, 77, 110, 103, this.format]);

		// Save the filenames
		this.dataFilename = `${this.dbPrefix}.dat`;
		this.indexFilename = `${this.dbPrefix}.idx`;
		this.cfpFilename = `${this.dbPrefix}.cfp`;

		// Check the files exist
		if(!existsSync(this.indexFilename) ||
		   !existsSync(this.dataFilename) ||
		   !existsSync(this.cfpFilename)) {
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
		if(header.some((value, index) => value !== this.headerToCheck[index])) {
			throw Error("Corrupted collection database");
		}

		const content = readFileSync(this.indexFilename, "utf8");
		const db = JSON.parse(content) as CollectionsIndex;
		if(db.version !== this.format) {
			throw Error(`Collection database index invalid: file format ${db.version} instead of ${this.format}`);
		}

		const collator = new Intl.Collator();
		this.entries = db.index.toSorted((a, b) => collator.compare(a.title, b.title));
		this.countEntries = this.entries.length;
		this.cfpLength = db.cfpLength;

		// Map from fpIdx to corresponding entries
		for(let i=0; i < this.countEntries; ++i) {
			const fpIdx = this.entries[i].fpIdx;
			if(this.mapCfp.has(fpIdx)) {
				this.mapCfp.get(fpIdx)!.push(i);
			}
			else {
				this.mapCfp.set(fpIdx, [i]);
			}
		}

		// Create the indices
		let id = 0;
		for(const entry of this.entries) {

			if(entry.proto) {
				const out: PrototypeIndex = {
					positionStructure: entry.start,
					pearson: entry.pearson ?? "",
					strukturbericht: entry.strukturbericht ?? "",
					mineral: entry.title
				};
				this.prototypeMap.set(entry.aflow, out);
			}
			else {
				const out: CollectionIndex = {
					positionStructure: entry.start,
					mineral: entry.title,
				};
				this.collectionMap.set(id, out);
				++id;
			}
		}

		// Cache the fingerprint file
		this.cacheFingerprintFile();
	}

	/**
	 * Data at a given offset to structure
	 *
	 * @param offset - Offset in the data file for the structure
	 * @returns The structure read
	 */
	private data2structure(offset: number): Structure {

		// Initialize the read
		const structure = new EmptyStructure();
		const fd = openSync(this.dataFilename, "r");

		// Number of atoms
		const natomsBuffer = new Uint8Array(2);
		readSync(fd, natomsBuffer, 0, 2, offset);
		const natoms = natomsBuffer[1]*256+natomsBuffer[0];

		// Atom types
		const atomsZBuffer = new Uint8Array(natoms);
		readSync(fd, atomsZBuffer, 0, natoms, offset+2);

		const floatPart = new Float32Array(9+natoms*3);
		const floatLength = floatPart.byteLength;
		readSync(fd, floatPart, 0, floatLength, offset+2+natoms);
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
	 * Cache the fingerprints if not already loaded
	 */
	private cacheFingerprintFile(): void {

		// If already loaded do nothing
		if(this.cfp && this.countEntries && this.cfp.length > 0) return;

		const fd = openSync(this.cfpFilename, "r");
		this.cfp = new Float64Array(this.countEntries*this.cfpLength);
		const bytes = readSync(fd, this.cfp);
		closeSync(fd);

		if(bytes === 0) throw Error("Collection fingerprints not loaded");
		if(this.cfp.length === this.countEntries*this.cfpLength) return;
		const n = this.cfp.BYTES_PER_ELEMENT;
		throw Error(`Fingerprint file size ${this.cfp.length*n} ` +
					" is not a multiple of the number of entries " +
					this.countEntries*this.cfpLength*n);
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

	// > Exported functions
	// >> Prototypes
	/**
	 * Prepare the list for querying the prototype database
	 *
	 * @returns JSON encoded list of prototypes names and aflow UID
	 */
	prototypeLoadList(): string {

		return this.entries ? JSON.stringify(this.entries
							.filter((e) => e.proto)
							.map((e) => ({
								title: e.title.replaceAll(/<\/?sub>/gu, ""),
								aflow: e.aflow
							}))) : "";
	}

	/**
	 * Get prototype for a given UID formatted for reader
	 *
	 * @param aflow - Aflow UID
	 * @returns Prototype data as ordinary structure (undefined if not found)
	 */
	prototypeGetStructure(aflow: string): PrototypeStructure | undefined {

		const entry = this.prototypeMap.get(aflow);
		if(entry === undefined) return undefined;

		return {
			pearson: entry.pearson,
			aflow,
			strukturbericht: entry.strukturbericht,
			mineral: entry.mineral,
			structure: this.data2structure(entry.positionStructure)
		};
	}

	// >> Collection
	collectionLoadList(): string {

		return this.entries ? JSON.stringify(this.entries
							.filter((e) => !e.proto)
							.map((e, idx) => ({
								title: e.title.replaceAll(/<\/?sub>/gu, ""),
								id: idx
							}))) : "";
	}

	collectionGetStructure(id: string): CollectionStructure | undefined {

		const idn = Number.parseInt(id, 10);
		const entry = this.collectionMap.get(idn);
		if(entry === undefined) return undefined;

		return {
			mineral: entry.mineral,
			structure: this.data2structure(entry.positionStructure)
		};
	}

	/**
	 * Get structures near the given one
	 *
	 * @param fp - Fingerprint to test
	 * @param n - Number of nearest structures to return
	 * @returns List of nearest structures id, title and distance
	 */
	getNearestStructures(fp: Float64Array, n=1): CollectionsIndexEntry[] {

		if(n < 1) n = 1;
		if(fp.length !== this.cfpLength) return [];

		const dq = new DistancesQueue(n);

		for(const fpIdx of this.mapCfp.keys()) {

			// Check if this is an excluded file
			if(this.cfp![fpIdx*this.cfpLength] < -1) continue;

			// Compute distance
			const dist = this.computeFpDistance(fp, fpIdx);

			// Get the entries index
			const entryIdx = this.mapCfp.get(fpIdx)![0];

			// Group by distances
			dq.enqueue(dist, entryIdx);
		}

		const out: CollectionIndexEntry[] = [];

		const q = dq.dump();
		for(const entry of q) {
			out.push({
				id: entry.idx.toString(),
				title: this.entries![entry.idx].title,
				distance: entry.distance
			});
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
	 * @returns The StructureCollection object
	 */
    static getInstance(): StructureCollection {

        if(!StructureCollection.instance) {
            StructureCollection.instance = new StructureCollection();
        }

        return StructureCollection.instance;
    }
}

/**
 * Get structures near the given one
 *
 * @param fp - Fingerprint to test
 * @param n - Number of nearest structures to return
 * @returns List of nearest structures id, title and distance
 */
export const collectionsGetNearestStructures = (fp: Float64Array,
											   n=1): CollectionsIndexEntry[] =>
	StructureCollection.getInstance().getNearestStructures(fp, n);

/**
 * Prepare the list of entries for querying the prototype database
 *
 * @returns JSON encoded list of prototypes names and aflow UID
 */
export const prototypeLoadList = (): string =>
				StructureCollection.getInstance().prototypeLoadList();

/**
 * Get prototype for a given UID formatted for reader
 *
 * @param aflow - Aflow UID
 * @returns Prototype data as ordinary structure (undefined if not found)
 */
export const prototypeGetStructure = (aflow: string): PrototypeStructure | undefined =>
				StructureCollection.getInstance().prototypeGetStructure(aflow);

/**
 * Load the collection and return the index
 *
 * @returns JSON encoded list of collection entries and the corresponding id
 */
export const collectionLoadList = (): string =>
				StructureCollection.getInstance().collectionLoadList();

/**
 * Get the collection structure with the given ID
 *
 * @param id - ID of the collection entry to access
 * @returns The collection structure or undefined if not found
 * @throws Error.
 * "Collection database not loaded"
 */
export const collectionGetStructure = (id: string): CollectionStructure | undefined =>
				StructureCollection.getInstance().collectionGetStructure(id);
