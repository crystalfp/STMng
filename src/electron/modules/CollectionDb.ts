/**
 * Interface to the structure collection preprocessed database
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-07
 */
import {getAtomicSymbol} from "./AtomData";
import {EmptyStructure} from "./EmptyStructure";
import {closeSync, existsSync, openSync, readFileSync, readSync} from "node:fs";
import type {Structure, Atom} from "@/types";

/**
 * Collection database index content
 * @notExported
 */
interface CollectionDbEntry {
	/** User facing structure title */
	title: string;
	/** Start byte of the structure in the db */
	start: number;
	/** Length of the structure in the db */
	length: number;
}

/**
 * Index of the collection
 * @notExported
 */
interface CollectionIndexEntry {
	/** Unique structure identifier */
	id: string;
	/** User facing structure title */
	title: string;
}

/**
 * Access to the structure collection in binary form
 */
export class CollectionDb {

	private entries: CollectionDbEntry[] | undefined;
	private dbPrefix = "";
	private readonly headerToCheck: Uint8Array;
	private indexFilename = "";
	private dataFilename = "";

	/**
	 * Initialize the interface to the collection db
	 */
	constructor() {

		// Data file magic ("STMng") and file format version (1-255)
		const fileVersion = 1;
		this.headerToCheck = new Uint8Array([83, 84, 77, 110, 103, fileVersion]);
	}

	/**
	 * Load the collection and return the index
	 *
	 * @param prefix - Filename without extension for the two files that
	 *    			   compose the database (extensions .idx and .dat)
	 * @returns Array of db index entries
	 * @throws Error.
	 * "Collection database not found" or "Corrupted collection database" or
	 * "Collection database format invalid"
	 */
	loadList(prefix: string): CollectionIndexEntry[] {

		// If not already loaded load it
		if(!this.entries?.length || this.dbPrefix !== prefix) {

			this.dataFilename = `${prefix}.dat`;
			this.indexFilename = `${prefix}.idx`;

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
				throw Error(`Collection database format invalid ${header[5]} instead of ${this.headerToCheck[5]}`);
			}
			if(!header.every((value, index) => value === this.headerToCheck[index])) {
				throw Error("Corrupted collection database");
			}

			const content = readFileSync(this.indexFilename, "utf8");
			this.entries = JSON.parse(content) as CollectionDbEntry[];
			this.dbPrefix = prefix;
		}

		const out: CollectionIndexEntry[] = [];
		for(let i=0; i < this.entries.length; ++i) {
			out.push({
				id: i.toString(),
				title: this.entries[i].title
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

		if(!this.entries) throw Error("Collection database not loaded");

		const idx = Number.parseInt(id, 10);
		if(Number.isNaN(idx) || idx < 0 || idx >= this.entries.length) return;
		const entry = this.entries[idx];
		if(!entry) return;
		const {start, length} = entry;

		const structure = new EmptyStructure();

		const fd = openSync(`${this.dbPrefix}.dat`, "r");
		const natomsBuffer = new Uint8Array(1);
		readSync(fd, natomsBuffer, 0, 1, start);
		const natoms = natomsBuffer[0];
		const atomsZBuffer = new Uint8Array(natoms);
		readSync(fd, atomsZBuffer, 0, natoms, start+1);
		const floatPart = new Float32Array(9+natoms*3);
		const floatLength = floatPart.byteLength;
		readSync(fd, floatPart, 0, floatLength, start+1+natoms);
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

		const sgStart = start + 1 + natoms + floatLength;
		const sgLength = length - (sgStart - start);
		const spaceGroupBuffer = new Uint8Array(sgLength);
		readSync(fd, spaceGroupBuffer, 0, sgLength, sgStart);
		structure.crystal.spaceGroup = Buffer.from(spaceGroupBuffer).toString("utf8");

		closeSync(fd);

		return structure;
	}
}
