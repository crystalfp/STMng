/**
 * Routines to match structures to their crystal prototypes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
import {getPrimitiveStructure, getReducedStructure} from "./Structure";
import {StructureMatcher} from "./StructureMatcher";
import type {Prototype, SNL, PrototypeEntry} from "./types";

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
	private readonly aflowPrototypeLibrary:  PrototypeEntry[] = [];

	/**
	 * Initialize the prototype matcher.
	 *
	 * Tolerances as defined in StructureMatcher. Tolerances will be
     * gradually decreased until only a single match is found (if possible).
	 *
	 * @param preprocessedPrototypes - The list of prototypes preprocessed from the Aflow list
	 * @param initialLtol - Fractional length tolerance
	 * @param initialStol - Site tolerance
	 * @param initialAngleTol - Angle tolerance
	 */
	constructor(preprocessedPrototypes: PrototypeEntry[],
				initialLtol = 0.2,
        		initialStol = 0.3,
        		initialAngleTol = 5) {

		this.initialLtol = initialLtol;
		this.initialStol = initialStol;
		this.initialAngleTol = initialAngleTol;
		this.aflowPrototypeLibrary = preprocessedPrototypes;
	}

	/**
	 * Match input structure to the list of prototypes
	 *
	 * @param sm - The structure matcher class instance
	 * @param reducedStructure - The reduced structure from the input one
	 * @returns List of found prototypes
	 */
	private matchPrototype(sm: StructureMatcher, reducedStructure: SNL): Prototype[] {

        const tags: Prototype[] = [];
		for(const entry of this.aflowPrototypeLibrary) {

			// Adapt to the preprocessed format of the aflow library
			const snl = {lattice: entry.structure.lattice, sites: entry.structure.sites};

			// Since both structures are already reduced, we can skip the structure reduction step
            const match = sm.fitAnonymous(snl, reducedStructure, true);
            if(match?.length) tags.push({tags: entry.tags});
		}
        return tags;
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
	 * @param snl - The structure in SNL format
	 * @returns A list of dicts with keys "snl" for the matched prototype and
	 *              "tags", a dict of tags ("mineral", "strukturbericht" and "aflow") of that
	 *              prototype. This should be a list containing just a single entry, but it is
	 *              possible a material can match multiple prototypes.
	 */
	getPrototypes(snl: SNL): Prototype[] {

		const reducedStructure = getReducedStructure(snl);
		const primitiveStructure = getPrimitiveStructure(reducedStructure);

		const sm = new StructureMatcher(
			this.initialLtol,
            this.initialStol,
            this.initialAngleTol,
		);

		let prototypes = this.matchPrototype(sm, primitiveStructure);
        while(prototypes.length > 1) {
            sm.ltol *= 0.8;
            sm.stol *= 0.8;
            sm.angleTol *= 0.8;
            prototypes = this.matchPrototype(sm, primitiveStructure);
            if(sm.ltol < 0.01) break;
		}

		return prototypes;
	}
}
