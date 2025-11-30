/**
 * Routines to match structures to their crystal prototypes.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-09-24
 */
import {matrixToLattice} from "./PymatgenLattice";
import {getPrimitiveStructure, getReducedStructure} from "./PymatgenStructure";
import {cartesianToFractionalCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {getAtomicSymbol} from "../modules/AtomData";
import {StructureMatcher} from "./StructureMatcher";
import type {Structure} from "../../types";
import type {Prototype, SNL, Site, PrototypeEntry} from "./types";

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
class AflowPrototypeMatcher {

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
	 * Convert structure to the format required by the code
	 *
	 * @param structure - STMng structure to be converted
	 * @returns The structure in SNL format or undefined if it has no unit cell
	 */
	private structureToSNL(structure: Structure): SNL | undefined {

		const {crystal, atoms} = structure;
		const {basis}= crystal;

		if(hasNoUnitCell(basis)) return;

		const matrix = [
			[basis[0], basis[1], basis[2]],
			[basis[3], basis[4], basis[5]],
			[basis[6], basis[7], basis[8]]
		];

		const lattice = matrixToLattice(matrix);

		const fr = cartesianToFractionalCoordinates(structure);

		return {
            sites: atoms.map((atom, idx): Site => ({
				abc: [fr[3*idx], fr[3*idx+1], fr[3*idx+2]],
				xyz: atom.position,
				label: atom.label,
				species: [
					{element: getAtomicSymbol(atom.atomZ), occu: 1}
				]
            })),
            lattice
        };
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
	 * @param structure - structure to match
	 * @returns A list of dicts with keys "snl" for the matched prototype and
	 *              "tags", a dict of tags ("mineral", "strukturbericht" and "aflow") of that
	 *              prototype. This should be a list containing just a single entry, but it is
	 *              possible a material can match multiple prototypes.
	 */
	getPrototypes(structure: Structure): Prototype[] {

		// Convert STMng Structure to Pymatgen SNL
		const snl = this.structureToSNL(structure);
		if(!snl) return [];

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

/**
 * Find the matching prototype to a given structure
 *
 * @param structure - The structure to match
 * @param preprocessedPrototypes - The list of prototypes preprocessed from the Aflow list
 * @param initialLtol - Fractional length tolerance
 * @param initialStol - Site tolerance
 * @param initialAngleTol - Angle tolerance
 * @returns List of matched prototypes
 */
export const findMatchingPrototypes = (
		structure: Structure,
		preprocessedPrototypes: PrototypeEntry[],
		initialLtol = 0.2,
		initialStol = 0.3,
		initialAngleTol = 5): Prototype[] => {

	const afpm = new AflowPrototypeMatcher(preprocessedPrototypes,
										   initialLtol, initialStol,
										   initialAngleTol);
	return afpm.getPrototypes(structure);
};
