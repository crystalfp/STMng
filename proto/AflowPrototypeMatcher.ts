import type {Structure} from "../src/types";
import {createReadStream} from "node:fs";
import {createGunzip} from "node:zlib";
import {getNiggliReducedLattice} from "./PymatgenLattice";


export interface Prototype {
	snl: string; // Strukturbericht designation
	tags: Record<string, string>; // Additional tags or descriptors
}


interface Lattice {
	matrix: number[][];
	a: number;
	b: number;
	c: number;
	alpha: number;
	beta: number;
	gamma: number;
	volume: number;
}
interface Site {
	species: {
		element: string;
		occu: number;
	}[];
	abc: number[];
	xyz: number[];
	label: string;
}

interface SNL {
	lattice: Lattice;
	sites: Site[];
}

interface LibraryEntry {
	snl: SNL;
	about: Record<string, unknown>;
	tags: Record<string, string>;
}

export class AflowPrototypeMatcher {

	private readonly initialLtol: number;
	private readonly initialStol: number;
	private readonly initialAngleTol: number;
	private readonly aflowPrototypeLibrary: {snl: SNL; dct: LibraryEntry}[] = [];

	/**
	 * Tolerances as defined in StructureMatcher. Tolerances will be
     * gradually decreased until only a single match is found (if possible).
	 *
	 * @param initialLtol - fractional length tolerance
	 * @param initialStol - site tolerance
	 * @param initialAngleTol - angle tolerance
	 */
	constructor(initialLtol = 0.2,
        		initialStol = 0.3,
        		initialAngleTol = 5) {

		this.initialLtol = initialLtol;
		this.initialStol = initialStol;
		this.initialAngleTol = initialAngleTol;

		// Read compressed AFLOW prototypes
		const gunzip = createGunzip();
		const source = createReadStream("./aflow_prototypes.json.gz");
		const stream = source.pipe(gunzip);

		let rawResult = "";
		stream.on("data", (chunk: Buffer) => {
    		rawResult += chunk.toString("utf8");
		});
		stream.on("end", () => {
			// Preprocess AFLOW prototypes
			const AFLOW_PROTOTYPE_LIBRARY = JSON.parse(rawResult) as LibraryEntry[];
			console.log(JSON.stringify(AFLOW_PROTOTYPE_LIBRARY, undefined, 2));

			for(const dct of AFLOW_PROTOTYPE_LIBRARY) {

				const reducedStructure = getReducedStructure(dct.snl);
				const primitiveStructure = getPrimitiveStructure(reducedStructure);
				this.aflowPrototypeLibrary.push({snl: primitiveStructure, dct});
			}
		});
	}

	getPrototypes(structure: Structure): Prototype[] {

		void structure;
		void this.initialAngleTol;
		void this.initialLtol;
		void this.initialStol;

		const prototypes: Prototype[] = [];

		return prototypes;
	}
}

/**
 * Get a reduced structure
 * The lattice reduction algorithm used is "Niggli"
 *
 * @param snl - The structure to reduce
 * @returns The Niggli-reduced structure
 */
const getReducedStructure = (snl: SNL): SNL => {

	const reducedLattice = getNiggliReducedLattice(snl.lattice.matrix);

	void reducedLattice; // TBD
	return snl;
};

const getPrimitiveStructure = (structure: SNL): SNL => {

	return structure;
};
