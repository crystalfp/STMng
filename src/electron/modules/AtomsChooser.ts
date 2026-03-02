/**
 * Select the atoms from AtomsSelector widget output
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */
import {getAtomicSymbol} from "./AtomData";
import type {Structure} from "@/types";

/** Valid values for the selection type */
export type SelectorType = "symbol" | "label" | "index" | "all";

/**
 * Select atoms in the structure by the criteria entered in the AtomsChooser widget
 *
 * @param structure - The structure for which atoms should be selected
 * @param kind - Kind of selection. Could be: "symbol", "label", "index" or "all"
 * @param atomsSelector - The human entered space separated string of selectors
 * @returns List of atoms indices selected in the structure
 */
export const selectAtomsByKind = (structure: Structure,
								  kind: SelectorType,
								  atomsSelector: string): number[] => {

	// Prepare selectors
	let selectorsList: string[] = [];
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
			for(const entry of selectorsList) {
				const idx = Number.parseInt(entry, 10);
				if(Number.isNaN(idx) || idx < 0 || idx >= natoms) {
					continue;
				}
				selectedAtomsIdx.push(idx);
			}
			break;
		case "all":
			for(let idx=0; idx < natoms; ++idx) selectedAtomsIdx.push(idx);
			break;
	}
	return selectedAtomsIdx;
};

const atomSymbols = new Set([
	"d", "h", "he", "li", "be", "b", "c", "n", "o", "f", "ne", "na", "mg",
	"al", "si", "p", "s", "cl", "ar", "k", "ca", "sc", "ti", "v", "cr", "mn",
	"fe", "co", "ni", "cu", "zn", "ga", "ge", "as", "se", "br", "kr", "rb",
	"sr", "y", "zr", "nb", "mo", "tc", "ru", "rh", "pd", "ag", "cd", "in",
	"sn", "sb", "te", "i", "xe", "cs", "ba", "la", "ce", "pr", "nd", "pm",
	"sm", "eu", "gd", "tb", "dy", "ho", "er", "tm", "yb", "lu", "hf", "ta",
	"w", "re", "os", "ir", "pt", "au", "hg", "tl", "pb", "bi", "po", "at",
	"rn", "fr", "ra", "ac", "th", "pa", "u", "np", "pu", "am", "cm", "bk",
	"cf", "es", "fm", "md", "no", "lr", "rf", "db", "sg", "bh", "hs", "mt",
	"ds", "rg"
]);

/**
 * Check atoms selector validity
 *
 * @param structure - The structure for which atoms should be selected
 * @param kind - Kind of selection. Could be: "symbol", "label", "index" or "all"
 * @param atomsSelector - The human entered space separated string of selectors
 * @returns Empty string if all selectors are valid for the given "kind", otherwise the error string
 */
export const checkAtomsSelector = (structure: Structure,
								   kind: SelectorType,
								   atomsSelector: string): string => {

	// Prepare selectors
	if(kind === "all") return "";
	atomsSelector = atomsSelector.trim();
	if(atomsSelector === "") return "";
	const selectorsList = atomsSelector.toLowerCase().split(/\s+/);

	// Extract structure parts
	const {atoms} = structure;
	const natoms = atoms.length;
	if(natoms === 0) return "";

	switch(kind) {
		case "symbol":
			for(const entry of selectorsList) {
				if(!atomSymbols.has(entry.toLowerCase())) {
					return `Invalid atom symbol "${entry}"`;
				}
			}
			break;

		case "label": {
			const labels = new Set<string>();
			for(const atom of atoms) labels.add(atom.label.toLowerCase());
			for(const entry of selectorsList) {
				if(!labels.has(entry)) {
					return `Non existent label "${entry}"`;
				}
			}
			break;
		}
		case "index":
			for(const entry of selectorsList) {
				if(!/^\d+$/.test(entry)) {
					return `Invalid index "${entry}"`;
				}
				const idx = Number.parseInt(entry, 10);
				if(Number.isNaN(idx)) {
					return `Invalid index "${entry}"`;
				}
				if(idx < 0 || idx >= natoms) {
					return `Index "${entry}" out of range`;
				}
			}
			break;
	}

	return "";
};
