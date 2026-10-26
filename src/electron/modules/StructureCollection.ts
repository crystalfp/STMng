/**
 * Access structures from the Collection and the Prototypes lists
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
import {existsSync, openSync, readSync, closeSync, readFileSync} from "node:fs";
import {publicDirPath} from "./GetPublicPath";
import {getAtomicSymbol} from "./AtomData";
import {EmptyStructure} from "./EmptyStructure";
import type {Atom, Structure} from "@/types";

/**
 * Common part for all index entries in the db file
 * @notExported
 */
interface CollectionsCommon {
	/** Entry identifier: is the index in the entries list */
	id: number;
	/** User facing structure title */
	title: string;
	/** Start byte of the structure in the db */
	start: number;
	/** Fingerprint index */
	fpIdx: number;
}

/**
 * Specific entries for prototypes
 * @notExported
 */
interface PrototypesAdd {
	/** Aflow UID (mandatory for the prototypes entries) */
	aflow: string;
	/** Pearson code (optional for the prototypes entries) */
	pearson?: string;
	/** Strukturbericht code (optional for the prototypes entries) */
	strukturbericht?: string;
}

/**
 * Entries in the .idx file "index" array
 * @notExported
 */
type CollectionsEntry = CollectionsCommon & (
	{proto: false} |
	({proto: true} & PrototypesAdd)
);

/**
 * Collection database .idx file content
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
	name: string;
	/** Prototype structure */
	structure: Structure;
}

/**
 * collectionGetStructure return type
 * @notExported
 */
interface CollectionStructure {

	/** Collection element mineral/component name */
	name: string;
	/** Collection structure */
	structure: Structure;
}

/**
 * Index of the similar structures list
 * @notExported
 */
export interface SimilarStructuresEntry {
	/** Unique structure identifier */
	id: number;
	/** User facing structure title */
	title: string;
	/** Distance from the given structure  */
	distance: number;
}

/** Return type of getStructure */
type CollectionsStructure = CollectionsEntry & {structure: Structure};

/**
 * Distance queue entry
 * @notExported
 */
interface QueueEntry {
	/** Distance value */
	distance: number;
	/** Corresponding index */
	idx: number;
}

/** Max user selectable number of similar structures */
const MAX_SELECTABLE = 8;

/**
 * Class to conserve the n min distances
 */
class DistancesQueue {

	private readonly entries: QueueEntry[];
	private readonly size: number;

	/**
	 * Build the distance queue
	 *
	 * @param length - Length of the queue
	 */
	constructor(length: number) {

		this.size = Math.max(length, 1);
		this.entries = Array<QueueEntry>(this.size);
		for(let i=0; i < this.size; ++i) {
			this.entries[i] = {distance: Number.POSITIVE_INFINITY, idx: 0};
		}
	}

	/**
	 * Add a new distance to the queue (if less of the ones already stored)
	 *
	 * @param distance - Distance to add
	 * @param idx - Corresponding key
	 */
	enqueue(distance: number, idx: number): void {

		if(distance > this.entries.at(-1)!.distance) return;

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
						this.entries[j+1].distance = this.entries[j].distance;
						this.entries[j+1].idx = this.entries[j].idx;
					}
					this.entries[i].distance = distance;
					this.entries[i].idx = idx;
					break;
				}
			}
		}
	}

	/**
	 * Dump the first maxLength entries from the queue
	 *
	 * @param maxLength - Number of entries to dump
	 * @returns The valid queue entries
	 */
	dump(maxLength: number): QueueEntry[] {

		if(maxLength < 1) maxLength = 1;
		else if(maxLength > this.size) maxLength = this.size;

		const out: QueueEntry[] = [];
		for(let i=0; i < maxLength; ++i) {
			if(this.entries[i].distance === Number.POSITIVE_INFINITY) {
				return out;
			}
			out.push(this.entries[i]);
		}

		return out;
	}

	/**
	 * Empty the queue
	 */
	clean(): void {
		for(const entry of this.entries) entry.distance = Number.POSITIVE_INFINITY;
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
			throw Error("Collection database invalid: " +
						`file format ${header[5]} instead of ${this.headerToCheck[5]}`);
		}
		if(header.some((value, index) => value !== this.headerToCheck[index])) {
			throw Error("Corrupted collection database");
		}

		const content = readFileSync(this.indexFilename, "utf8");
		const db = JSON.parse(content) as CollectionsIndex;
		if(db.version !== this.format) {
			throw Error("Collection database index invalid: " +
						`file format ${db.version} instead of ${this.format}`);
		}

		const collator = new Intl.Collator();
		this.entries = db.index
							.toSorted((a, b) => collator.compare(a.title, b.title))
							.map((e, idx) => ({...e, id: idx}));
		this.countEntries = this.entries.length;
		this.cfpLength = db.cfpLength;

		// Map from fpIdx to corresponding entries
		for(let i=0; i < this.countEntries; ++i) {
			const fpIdx = this.entries[i].fpIdx;
			this.mapCfp.getOrInsert(fpIdx, []).push(i);
		}

		// Reorder entries to have the most significative name first
		for(const ids of this.mapCfp.values()) {
			ids.sort((a, b) => {
				const na = this.entries![a].title;
				if(na.startsWith("Aflow")) return 1;
				const nb = this.entries![b].title;
				return nb.startsWith("Aflow") ? -1 : 0;
			});
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
								idx: e.id
							}))) : "";
	}

	/**
	 * Get prototype at a given index formatted for reader
	 *
	 * @param idx - prototype index
	 * @returns Prototype data as ordinary structure (undefined if not found)
	 */
	prototypeGetStructure(idx: number): PrototypeStructure | undefined {

		if(idx < 0 || idx >= this.countEntries) return;
		const entry = this.entries![idx];
		if(!entry.proto) return;
		return {
			pearson: entry.pearson ?? "",
			aflow: entry.aflow,
			strukturbericht: entry.strukturbericht ?? "",
			name: entry.title,
			structure: this.data2structure(entry.start)
		};
	}

	// >> Collection
	/**
	 * Prepare the list for querying the collection database
	 *
	 * @returns JSON encoded list of collection names and indices
	 */
	collectionLoadList(): string {

		return this.entries ? JSON.stringify(this.entries
							.filter((e) => !e.proto)
							.map((e) => ({
								title: e.title.replaceAll(/<\/?sub>/gu, ""),
								idx: e.id
							}))) : "";
	}

	/**
	 * Get collection entry at a given index formatted for reader
	 *
	 * @param idx - Collection structure index
	 * @returns Collection entry data as ordinary structure (undefined if not found)
	 */
	collectionGetStructure(idx: number): CollectionStructure | undefined {

		if(idx < 0 || idx >= this.countEntries) return;
		const entry = this.entries![idx];
		if(entry.proto) return;

		return {
			name: entry.title,
			structure: this.data2structure(entry.start)
		};
	}

	/**
	 * Get structure with full metadata
	 *
	 * @param idx - Index of the structure to return
	 * @returns The selected structure or undefined if not found
	 */
	getStructure(idx: number): CollectionsStructure | undefined {

		if(idx < 0 || idx >= this.countEntries) return;
		const entry = this.entries![idx];
		return {...entry, structure: this.data2structure(entry.start)};
	}

	/**
	 * Get structure metadata
	 *
	 * @param idx - Index of the structure to return
	 * @returns Metadata of the selected structure or undefined if not found
	 */
	getMetadata(idx: number): CollectionsEntry | undefined {

		if(idx < 0 || idx >= this.countEntries) return;
		return this.entries![idx];
	}

	/**
	 * Get structures near the given one
	 *
	 * @param fp - Fingerprint to test
	 * @param n - Number of nearest structures to return
	 * @returns List of nearest structures id, title and distance
	 */
	getNearestStructures(fp: Float64Array, n=1): SimilarStructuresEntry[] {

		if(n < 1) n = 1;
		if(fp.length !== this.cfpLength) return [];

		const dq = new DistancesQueue(MAX_SELECTABLE);

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

		const out: SimilarStructuresEntry[] = [];

		const q = dq.dump(n);
		for(const entry of q) {
			out.push({
				id: entry.idx,
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
											    n=1): SimilarStructuresEntry[] =>
	StructureCollection.getInstance().getNearestStructures(fp, n);

/**
 * Prepare the list of entries for querying the prototype database
 *
 * @returns JSON encoded list of prototypes names and corresponding indices
 */
export const prototypeLoadList = (): string =>
				StructureCollection.getInstance().prototypeLoadList();

/**
 * Get prototype for a given index formatted for reader
 *
 * @param idx - prototype index
 * @returns Prototype data as ordinary structure (undefined if not found)
 */
export const prototypeGetStructure = (idx: number): PrototypeStructure | undefined =>
				StructureCollection.getInstance().prototypeGetStructure(idx);

/**
 * Load the collection and return the index
 *
 * @returns JSON encoded list of collection entries and the corresponding index
 */
export const collectionLoadList = (): string =>
				StructureCollection.getInstance().collectionLoadList();

/**
 * Get the collection structure with the given index
 *
 * @param idx - Index of the collection entry to access
 * @returns The collection structure or undefined if not found
 * @throws Error.
 * "Collection database not loaded"
 */
export const collectionGetStructure = (idx: number): CollectionStructure | undefined =>
				StructureCollection.getInstance().collectionGetStructure(idx);

/**
 * Get structure with full metadata
 *
 * @param idx - Index of the structure to return
 * @returns The selected structure plus metadata
 */
export const getStructure = (idx: number): CollectionsStructure | undefined =>
				StructureCollection.getInstance().getStructure(idx);

/**
 * Get structure metadata
 *
 * @param idx - Index of the structure to return
 * @returns Metadata of the selected structure or undefined if not found
 */
export const getMetadata = (idx: number): CollectionsEntry | undefined =>
				StructureCollection.getInstance().getMetadata(idx);
