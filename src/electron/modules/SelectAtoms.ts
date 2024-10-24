/**
 * Select the atoms from AtomsSelector widget output
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {getAtomicSymbol} from "./AtomData";
import type {Structure} from "@/types";

export type SelectorType = "symbol" | "label" | "index" | "all";

/**
 * Select atoms in the structure by the criteria entered in the AtomsSelector widget
 *
 * @param structure - The structure for which atoms should be selected
 * @param kind - Kind of selection. Could be: "symbol", "label", "index"
 * @param atomsSelector - The human entered space separated string of selectors
 * @returns List of atoms indices selected in the structure
 */
export const selectAtomsByKind = (structure: Structure,
								  kind: SelectorType,
								  atomsSelector: string): number[] => {

	// Prepare selectors
	let selectorsList;
	let selectors;
	if(kind !== "all") {
		atomsSelector = atomsSelector.trim();
		if(atomsSelector === "") return [];
		selectorsList = atomsSelector.toLowerCase().split(/\s+/);
	}

	// Extract structure parts
	const {atoms} = structure;
	const natoms = atoms.length;
	if(natoms === 0) return [];

	// For each extraction criteria
	const selectedAtomsIdx = [];
	switch(kind) {
		case "symbol":
			selectors = new Set<string>(selectorsList);
			for(let idx=0; idx < natoms; ++idx) {
				const {atomZ} = atoms[idx];
				const symbol = getAtomicSymbol(atomZ).toLowerCase();
				if(selectors.has(symbol)) selectedAtomsIdx.push(idx);
			}
			break;

		case "label":
			selectors = new Set<string>(selectorsList);
			for(let idx=0; idx < natoms; ++idx) {
				const label = atoms[idx].label.toLowerCase();
				if(selectors.has(label)) selectedAtomsIdx.push(idx);
			}
			break;

		case "index":
			for(const selector of selectorsList!) {
				const index = Number.parseInt(selector, 10);
				if(Number.isNaN(index)) continue;
				selectedAtomsIdx.push(index);
			}
			break;
		case "all":
			for(let idx=0; idx < natoms; ++idx) selectedAtomsIdx.push(idx);
			break;
	}
	return selectedAtomsIdx;
};
