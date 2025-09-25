/**
 * Routines to match structures to their crystal prototypes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
import {createReadStream} from "node:fs";
import {createGunzip} from "node:zlib";
import {getPrimitiveStructure, getReducedStructure} from "./PymatgenStructure";
import type {Structure} from "../../types";
import type {Prototype, LibraryEntry, SNL} from "./types";

/**
 *  This class will match structures to their crystal prototypes, and will
    attempt to group species together to match structures derived from
    prototypes (e.g. an A_xB_1-x_C from a binary prototype), and will
    give these the names the "-like" suffix.

    This class uses data from the AFLOW LIBRARY OF CRYSTALLOGRAPHIC PROTOTYPES.
    If using this class, please cite their publication appropriately:

    Mehl, M. J., Hicks, D., Toher, C., Levy, O., Hanson, R. M., Hart, G., & Curtarolo, S. (2017).
    The AFLOW library of crystallographic prototypes: part 1.
    Computational Materials Science, 136, S1-S828.
    https://doi.org/10.1016/j.commatsci.2017.01.017
 */
export class AflowPrototypeMatcher {

	private readonly initialLtol: number;
	private readonly initialStol: number;
	private readonly initialAngleTol: number;
	private readonly aflowPrototypeLibrary: {snl: SNL; dct: LibraryEntry}[] = [];

	/**
	 * Initialize the prototype matcher.
	 *
	 * Tolerances as defined in StructureMatcher. Tolerances will be
     * gradually decreased until only a single match is found (if possible).
	 *
	 * @param initialLtol - Fractional length tolerance
	 * @param initialStol - Site tolerance
	 * @param initialAngleTol - Angle tolerance
	 */
	constructor(initialLtol = 0.2,
        		initialStol = 0.3,
        		initialAngleTol = 5) {

		this.initialLtol = initialLtol;
		this.initialStol = initialStol;
		this.initialAngleTol = initialAngleTol;

		// NOTE This should be adapted to access the data file under public
		const prototypesPath = "D:/Projects/STMng/src/electron/proto/aflow_prototypes.json.gz";

		// Read compressed AFLOW prototypes
		const gunzip = createGunzip();
		const source = createReadStream(prototypesPath);
		const stream = source.pipe(gunzip);

		let rawResult = "";
		stream.on("data", (chunk: Buffer) => {
    		rawResult += chunk.toString("utf8");
		});
		stream.on("end", () => {

			// Preprocess AFLOW prototypes
			const aflowPrototypeLibrary = JSON.parse(rawResult) as LibraryEntry[];

			for(const dct of aflowPrototypeLibrary) {

				const reducedStructure = getReducedStructure(dct.snl);
				const primitiveStructure = getPrimitiveStructure(reducedStructure);
				this.aflowPrototypeLibrary.push({snl: primitiveStructure, dct});
			}
		});
	}

	/**
	 * Get prototype(s) structures for a given input structure
	 *
	 * If you use this method in your work, please cite the appropriate AFLOW publication:
	 *
	 *	Mehl, M. J., Hicks, D., Toher, C., Levy, O., Hanson, R. M., Hart, G., & Curtarolo,
	 *	S. (2017). The AFLOW library of crystallographic prototypes: part 1. Computational
	 *	Materials Science, 136, S1-S828. https://doi.org/10.1016/j.commatsci.2017.01.017
	 *
	 * @param structure - structure to match
	 * @returns A list of dicts with keys "snl" for the matched prototype and
	 *              "tags", a dict of tags ("mineral", "strukturbericht" and "aflow") of that
	 *              prototype. This should be a list containing just a single entry, but it is
	 *              possible a material can match multiple prototypes.
	 */
	getPrototypes(structure: Structure): Prototype[] {

		void structure;
		void this.initialAngleTol;
		void this.initialLtol;
		void this.initialStol;

		const prototypes: Prototype[] = [];

		return prototypes;
	}
}
