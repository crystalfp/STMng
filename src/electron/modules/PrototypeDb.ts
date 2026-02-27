/**
 * Access the aflow prototypes database
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-21
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {readFileSync, existsSync} from "node:fs";
import {publicDirPath} from "./GetPublicPath";
import {EmptyStructure} from "./EmptyStructure";
import {getAtomicNumber, getAtomicSymbol} from "./AtomData";
import {hasNoUnitCell, invertBasis} from "./Helpers";
import {markDuplicates} from "./MarkDuplicates";
import {AflowPrototypeMatcher} from "../pymatgen/AflowPrototypeMatcher";
import {matrixToLattice} from "../pymatgen/Lattice";
import type {PrototypeEntry, PrototypeTags, Site, SNL} from "../pymatgen/types";
import type {DBType, PositionType, Structure} from "@/types";

/**
 * Correction to the Prototype library
 * @notExported
 */
interface AdjunctMap {
	/** Correction to the mineral field */
	m?: string;
	/** Correction to the strukturbericht field */
	s?: string;
	/** Correction to the pearson field */
	p?: string;
}

/**
 * Entries inside the Pymatgen prototypes library file
 * @notExported
 */
interface LibraryEntry {
	/** Prototype structure */
	snl: SNL;
	/** Corresponding tags */
	tags: PrototypeTags;
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
	/** Error message if any */
	error?: string;
}

/**
 * Found matches from the prototype db
 */
interface Matches {
	/** Match mineral field */
	mineral: string[];
	/** Corresponding Aflow UID */
	aflow: string[];
}

/**
 * Access to the prototypes collection
 */
class PrototypeDb {

	private static instance: PrototypeDb;

	private readonly aflowPrototypeLibrary: PrototypeEntry[] = [];
	private readonly aflowAdjunctMap = new Map<string, AdjunctMap>();
	private searchDb = "";
	private readonly aflowSrcPrototypeLibrary: LibraryEntry[] = [];
	private readonly aflowSrcMap = new Map<string, number>();
	private readonly uniqueAflowMap = new Set<string>();

	/**
	 * Build the class by loading the prototype data
	 */
	private constructor() {

		const filePath = publicDirPath("aflow_prepared_prototypes.json");
		const adjunctPath = publicDirPath("mineral_overrides.json");
		const prototypesPath = publicDirPath("aflow_prototypes.json");

		const aflowPrototypeLibraryRaw = readFileSync(filePath, "utf8");
		this.aflowPrototypeLibrary = JSON.parse(aflowPrototypeLibraryRaw) as PrototypeEntry[];
		if(this.aflowPrototypeLibrary.length === 0) throw Error("No prototypes loaded");

		if(existsSync(adjunctPath)) {
			const adjunctRaw = readFileSync(adjunctPath, "utf8");
			if(adjunctRaw) {
				const adjunct = JSON.parse(adjunctRaw) as Record<string, AdjunctMap>;
				for(const entry in adjunct) this.aflowAdjunctMap.set(entry, adjunct[entry]);
			}
		}

		const rawResult = readFileSync(prototypesPath, "utf8");
		this.aflowSrcPrototypeLibrary = JSON.parse(rawResult) as LibraryEntry[];

		for(let i=0; i < this.aflowSrcPrototypeLibrary.length; ++i) {
			this.aflowSrcMap.set(this.aflowSrcPrototypeLibrary[i].tags.aflow, i);
		}
	}

	/**
	 * Correct the tags entry if needed
	 *
	 * @param aflow - aflow UID of the entry
	 * @param tags - Tags from the Pymatgen file
	 * @returns Tags with the correction from the mineral overrides
	 */
	private correctTags(aflow: string, tags: PrototypeTags): PrototypeTags {

		const correction = this.aflowAdjunctMap.get(aflow);
		if(correction) {
			let mineral = correction.m ?? tags.mineral;
			// eslint-disable-next-line unicorn/better-regex
			mineral = mineral ? mineral.replaceAll(/\\.\{(.)\}/g, "$1") : "—";
			return {
				pearson: correction.p ?? tags.pearson,
				aflow,
				strukturbericht: correction.s ?? tags.strukturbericht,
				mineral
			};
		}

		// eslint-disable-next-line unicorn/better-regex
		const mineral = tags.mineral ? tags.mineral.replaceAll(/\\.\{(.)\}/g, "$1") : "—";
		return {
			pearson: tags.pearson,
			aflow,
			strukturbericht: tags.strukturbericht,
			mineral
		};
	}

	private makeAflowUnique(aflow: string): string {

		while(this.uniqueAflowMap.has(aflow)) {

			if(aflow.startsWith("#")) {
				const prefix = aflow.slice(1, 3);
				const taflow = aflow.slice(3);
				const idx = Number.parseInt(prefix, 10)+1;
				aflow = `#${idx.toString().padStart(2, "0")}${taflow}`;
			}
			else aflow = "#00" + aflow;
		}
		this.uniqueAflowMap.add(aflow);

		return aflow;
	}

	/**
	 * Get prototype tags for a given UID
	 * @remarks The aflowSrcPrototypeLibrary is already initialized
	 *
	 * @param aflow - Aflow UID
	 * @returns Prototype tags (undefined if not found)
	 */
	getPrototypeTags(aflow: string): (PrototypeTags & {error?: string}) | undefined {

		const idx = this.aflowSrcMap.get(aflow);
		if(idx === undefined) return undefined;

		const proto = this.aflowSrcPrototypeLibrary[idx];
		if(!proto) return undefined;

		return this.correctTags(aflow, proto.tags);
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
				position: [...site.xyz] as PositionType,
				label: site.label,
				chain: ""
			});
		}

		return structure;
	}

	/**
	 * Convert structure to the format required by the code
	 *
	 * @param structure - STMng structure to be converted
	 * @returns The structure in SNL format or undefined if it has no unit cell
	 */
	structureToSNL(structure: Structure, duplicates: boolean[]): SNL | undefined {

		const {crystal, atoms} = structure;
		const {basis, origin} = crystal;

		if(hasNoUnitCell(basis)) return undefined;

		const matrix = [
			[basis[0], basis[1], basis[2]],
			[basis[3], basis[4], basis[5]],
			[basis[6], basis[7], basis[8]]
		];

		const lattice = matrixToLattice(matrix);

		// Compute inverse matrix
		const inverse = invertBasis(basis);

		// Convert each atom into site
		const sites: Site[] = [];
		let idx = 0;
		for(const {position, label, atomZ} of atoms) {

			if(duplicates[idx++]) continue;

			const cx = position[0] - origin[0];
			const cy = position[1] - origin[1];
			const cz = position[2] - origin[2];

			const abc = [cx*inverse[0] + cy*inverse[3] + cz*inverse[6],
						 cx*inverse[1] + cy*inverse[4] + cz*inverse[7],
						 cx*inverse[2] + cy*inverse[5] + cz*inverse[8]];

			sites.push({
				abc,
				xyz: [...position],
				label: label,
				species: [
					{element: getAtomicSymbol(atomZ), occu: 1}
				]
			});
		}

		return {
			sites,
			lattice
		};
	}

	// > Exported functions
	/**
	 * Prepare the list for querying the prototype database
	 *
	 * @returns JSON encoded list of prototypes names and aflow UID
	 */
	prototypeLoadList(): string {

		if(this.searchDb) return this.searchDb;

		const db = new Map<string, string>();
		for(const proto of this.aflowSrcPrototypeLibrary) {

			const tags = this.correctTags(proto.tags.aflow, proto.tags);

			if(tags.mineral) {
				db.set(tags.mineral, this.makeAflowUnique(proto.tags.aflow));
			}
			db.set(proto.tags.aflow, this.makeAflowUnique(proto.tags.aflow));
		}

		const out: DBType[] = [];
		for(const [k, v] of db) {
			const title = k.replaceAll(/<\/?sub>/g, "");
			out.push({title, aflow: v});
		}

		this.searchDb = JSON.stringify(out.toSorted((a, b) => a.title.localeCompare(b.title)));

		return this.searchDb;
	}

	/**
	 * Get prototype for a given UID formatted for reader
	 *
	 * @param aflow - Aflow UID
	 * @returns Prototype data as ordinary structure (undefined if not found)
	 */
	prototypeGetStructure(aflow: string): PrototypeStructure | undefined {

		const idx = this.aflowSrcMap.get(aflow);
		if(idx === undefined) return undefined;

		const proto = this.aflowSrcPrototypeLibrary[idx];
		if(!proto) return undefined;

		const tags = this.correctTags(aflow, proto.tags);

		return {
			pearson: tags.pearson,
			aflow,
			strukturbericht: tags.strukturbericht,
			mineral: tags.mineral,
			structure: this.snlToStructure(proto.snl)
		};
	}

	/**
	 * Find the matching prototype to a given structure and format them for the client
	 *
	 * @remarks The prototype data is composed by, for example:
	 * 'pearson': 'cF8',
	 * 'aflow': 'AB_cF8_216_c_a',
	 * 'strukturbericht': 'B3',
	 * 'mineral': 'Zincblende, Sphalerite'
	 *
	 * @param structure - The structure to match
	 * @param initialLtol - Fractional length tolerance
	 * @param initialStol - Site tolerance
	 * @param initialAngleTol - Angle tolerance
	 * @returns JSON encoded prototypes found as [mineral, aflow][]
	 */
	findMatchingPrototypes(structure: Structure,
						   initialLtol: number,
						   initialStol: number,
						   initialAngleTol: number): Matches {

		const afpm = new AflowPrototypeMatcher(this.aflowPrototypeLibrary,
											   initialLtol, initialStol,
											   initialAngleTol);

		const {crystal, atoms} = structure;
		const duplicates = markDuplicates(atoms, crystal);

		// Convert STMng Structure to Pymatgen SNL
		const snl = this.structureToSNL(structure, duplicates);

		// If valid get the prototypes
		if(!snl) return {mineral: [], aflow: []};
		const prototypes = afpm.getPrototypes(snl);

		// If no prototypes found
		if(prototypes.length === 0) return {mineral: [], aflow: []};

		// Format an ordered list for display
		const out: Matches = {mineral: [], aflow: []};
		for(const entry of prototypes) {

			const tags = this.getPrototypeTags(entry.tags.aflow);
			out.mineral.push(tags ? tags.mineral : "—");
			out.aflow.push(entry.tags.aflow);
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
 * Prepare the list of entries for querying the prototype database
 *
 * @returns JSON encoded list of prototypes names and aflow UID
 */
export const prototypeLoadList = (): string =>
								PrototypeDb.getInstance().prototypeLoadList();

/**
 * Get prototype for a given UID formatted for reader
 *
 * @param aflow - Aflow UID
 * @returns Prototype data as ordinary structure (undefined if not found)
 */
export const prototypeGetStructure = (aflow: string): PrototypeStructure | undefined =>
						PrototypeDb.getInstance().prototypeGetStructure(aflow);

/**
 * Find the matching prototypes to a given structure and format them for the client
 *
 * @remarks The prototype data is composed by, for example:
 * 'pearson': 'cF8',
 * 'aflow': 'AB_cF8_216_c_a',
 * 'strukturbericht': 'B3',
 * 'mineral': 'Zincblende, Sphalerite'
 *
 * @param structure - The structure to match
 * @param initialLtol - Fractional length tolerance
 * @param initialStol - Site tolerance
 * @param initialAngleTol - Angle tolerance
 * @returns Prototypes found as {mineral[], aflow[]}
 */
export const findMatchingPrototypes = (structure: Structure,
									   initialLtol: number,
									   initialStol: number,
									   initialAngleTol: number): Matches =>
					PrototypeDb.getInstance().findMatchingPrototypes(structure,
						initialLtol, initialStol, initialAngleTol);
