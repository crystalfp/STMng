import {getAtomicRadiiAndColor} from "./AtomData";
import type {Atom, Look} from "../../types";

export const getStructureAppearance = (atoms: Atom[]): Look => {

	// Find distinct atom species
	const distinctAtoms = new Set<number>();
	for(const atom of atoms) distinctAtoms.add(atom.atomZ);

	const out: Look = {};
	for(const atomZ of distinctAtoms) {

		out[atomZ] = getAtomicRadiiAndColor(atomZ);
	}

	return out;
};
