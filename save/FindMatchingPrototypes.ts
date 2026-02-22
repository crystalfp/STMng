/**
 * Find the matching prototype to a given structure.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-12-07
 */
import {AflowPrototypeMatcher} from "../pymatgen/AflowPrototypeMatcher";
import {matrixToLattice} from "../pymatgen/Lattice";
import {cartesianToFractionalCoordinates, hasNoUnitCell} from "../modules/Helpers";
import {getAtomicSymbol} from "../modules/AtomData";
import type {Structure} from "../../types";
import type {Prototype, PrototypeEntry, SNL, Site} from "../pymatgen/types";


/**
 * Convert structure to the format required by the code
 *
 * @param structure - STMng structure to be converted
 * @returns The structure in SNL format or undefined if it has no unit cell
 */
export const structureToSNL = (structure: Structure): SNL | undefined => {

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
};

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

	// Convert STMng Structure to Pymatgen SNL
	const snl = structureToSNL(structure);

	// If valid get the prototypes
	if(snl) return afpm.getPrototypes(snl);
	return [];
};
