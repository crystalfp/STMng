/**
 * Accumulate structures for structure set analysis.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-29
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
import {getAtomicSymbol} from "../modules/AtomData";
import {hasNoUnitCell, invertBasis} from "../modules/Helpers";
import type {Structure, Atom, BasisType} from "@/types";

/**
 * Content of the entries of the accumulator
 */
export interface SetEntry {

	/** If the structure should be consider after filtering and removing duplicates */
	enabled: boolean;
	/** Step of the structure in the input full set of structures */
	step: number;
	/** The per structure energy */
	energy: number;
	/** The per atom energy */
	energyPerAtom: number;
	/** Volume of the unit cell */
	volume: number;

	/** Unit cell basis vectors */
	basis: BasisType;
	/** Atoms coordinates as [x1, y1, z1, x2, y2, z2, ...] */
	atomsPosition: number[];
	/** Atomic numbers of the structure atoms */
	atomsZ: number[];
	/** Map from atomic number to count of atoms with this atomic number */
	species: Map<number, number>;
	/** Chemical formula in HTML */
	formula: string;

	/** Size of each component part of this structure */
	parts: number[];
	/** Composition key (quantities separated by "-") */
	key: string;
	/** Distance from the convex hull */
	distance: number;

	/** Computed fingerprint for the structure */
	fingerprint: number[];
	/** Number of sections in the fingerprint */
	countSections: number;
	/** Length of each section */
	sectionLength: number;
	/** Computed weights */
	weights: number[];
}

/**
 * Accumulate structures for variable composition calculation.
 */
export class StructureSetsAccumulator {

	private readonly accumulator: SetEntry[] = [];
	private readonly allSpecies = new Set<number>();
	private readonly keyMap = new Map<string, number[]>();

	/**
	 * Extract the chemical formula of a structure
	 *
	 * @param atoms - Atoms in the input structure
	 * @returns The chemical formula as HTML string (with subscript as <sub></sub>)
	 */
	private getFormula(atoms: Atom[]): string {

		let formula = "";
		let currentZ = 0;
		let currentCount = 1;
		for(const atom of atoms) {
			if(currentZ === 0) currentZ = atom.atomZ;
			else if(atom.atomZ === currentZ) {
				++currentCount;
			}
			else {
				// Save atom part of the formula
				const sub = currentCount === 1 ? "" : `<sub>${currentCount}</sub>`;
				formula += `${getAtomicSymbol(currentZ)}${sub}`;

				// Reinitialize count
				currentZ = atom.atomZ;
				currentCount = 1;
			}
		}
		const sub = currentCount === 1 ? "" : `<sub>${currentCount}</sub>`;
		formula += `${getAtomicSymbol(currentZ)}${sub}`;

		return formula;
	}

	/**
	 * Compute the unit cell volume
	 *
	 * @param basis - Unit cell basis vectors
	 * @returns Unit cell volume
	 */
	private	getCellVolume(basis: BasisType): number {

		return basis[0]*basis[4]*basis[8] + basis[1]*basis[5]*basis[6] +
               basis[2]*basis[3]*basis[7] - basis[2]*basis[4]*basis[6] -
               basis[1]*basis[3]*basis[8] - basis[0]*basis[5]*basis[7];
	}

	/**
	 * Load a structure
	 *
	 * @param structure - Structure to be accumulated
	 */
	add(structure: Structure): void {

		// Check structure not empty, with unit cell and energy
		const {atoms, extra, crystal} = structure;
		if(atoms.length === 0) throw Error("Empty structure loaded");

		const {basis, origin} = crystal;
		if(hasNoUnitCell(basis)) throw Error("Structure has no unit cell");

		const {step, energy} = extra;
		if(energy === undefined) throw Error("Structure has no energy");

		// Fill the entry to accumulate
		const entry: SetEntry = {

			enabled: true,
			step,
			energy: energy*atoms.length,
			energyPerAtom: energy,
			volume: this.getCellVolume(basis),

			basis: [
				basis[0], basis[1], basis[2],
				basis[3], basis[4], basis[5],
				basis[6], basis[7], basis[8]
			],
			atomsPosition: [],
			atomsZ: [],
			species: new Map<number, number>(),
			formula: this.getFormula(atoms),

			parts: [],
			key: "1", // This is for one component structures
			distance: -1,

			fingerprint: [],
			countSections: 0,
			sectionLength: 0,
			weights: []
		};

		// Fill atoms
		for(const {atomZ, position} of atoms) {

			const n = entry.species.get(atomZ);
			entry.species.set(atomZ, n ? n+1 : 1);
			entry.atomsZ.push(atomZ);
			entry.atomsPosition.push(
				position[0] - origin[0],
				position[1] - origin[1],
				position[2] - origin[2]
			);
			this.allSpecies.add(atomZ);
		}

		// Add to the accumulator
		this.accumulator.push(entry);
	}

	/**
	 * Clear the accumulator
	 */
	clear(): void {
		this.accumulator.length = 0;
		this.allSpecies.clear();
		this.keyMap.clear();
	}

	/**
	 * Returns the count of accumulated structures
	 *
	 * @returns Count of structures
	 */
	size(): number {
		return this.accumulator.length;
	}

	/**
	 * Returns the count of enabled structures
	 *
	 * @returns Count of enabled structures
	 */
	enabledCount(): number {
		let count = 0;
		for(const entry of this.accumulator) {
			if(entry.enabled) ++count;
		}
		return count;
	}

	/**
	 * Return all species present in the accumulator as type string
	 *
	 * @returns List of atom symbols of the structures accumulated
	 */
	symbols(): string[] {

		// Prepare list of species
		const speciesSymbols: string[] = [];
		for(const atomZ of this.allSpecies) {
			speciesSymbols.push(getAtomicSymbol(atomZ));
		}

		return speciesSymbols;
	}

	/**
	 * Return all species present in the accumulator as Z values
	 *
	 * @returns Z values for the accumulated species
	 */
	species(): number[] {

		return [...this.allSpecies];
	}

	/**
	 * Iterator on the accumulated structures
	 *
	 * @returns An iterator on the selected structures
	 */
	* iterateStructures(): Generator<SetEntry> {

		for(const entry of this.accumulator) {
			yield entry;
		}
	}

	/**
	 * Iterator on the accumulated structures that are enabled
	 *
	 * @returns An iterator on the enabled structures
	 */
	* iterateEnabledStructures(): Generator<SetEntry> {

		for(const entry of this.accumulator) {
			if(entry.enabled) yield entry;
		}
	}

	/**
	 * Initialize the mapping between key and index to accumulator entries
	 */
	initializeKeyMap(): void {

		this.keyMap.clear();
		const count = this.accumulator.length;
		for(let i=0; i < count; ++i) {

			const {key} = this.accumulator[i];

			if(this.keyMap.has(key)) {
				this.keyMap.get(key)!.push(i);
			}
			else {
				this.keyMap.set(key, [i]);
			}
		}
	}

	/**
	 * Iterator on the composition keys that returns
	 * the list of indices of structures with the given key
	 *
	 * @returns An iterator on the composition keys
	 */
	* iterateKeys(): Generator<[string, number[]]> {

		for(const entry of this.keyMap) {
			yield entry;
		}
	}

	/**
	 * Get indices with a given key
	 *
	 * @param key - Key to extract
	 * @returns Array of indices of structures with the given key
	 * 			or undefined if key not found
	 */
	getIndicesForKey(key: string): number[] | undefined {
		return this.keyMap.get(key);
	}

	/**
	 * Return structure at index
	 *
	 * @param idx - Requested structure index
	 * @returns The corresponding accumulated structure
	 * 			or undefined if out of range
	 */
	getEntry(idx: number): SetEntry | undefined {
		if(idx < 0 || idx >= this.accumulator.length) return undefined;
		return this.accumulator[idx];
	}

	/**
	 * Set enable status on given elements
	 *
	 * @param indices - Elements whose enable status has to be set
	 * @param enable - Value to set
	 */
	setEnableStatus(indices: number[], enable: boolean): void {

		for(const idx of indices) {
			const entry = this.accumulator[idx];
			entry.enabled = enable;
		}
	}

	/**
	 * Check if structures have energies
	 *
	 * @returns True if structures have energies
	 */
	hasEnergies(): boolean {
		return true;
	}

	/**
	 * Get structure energy
	 *
	 * @param step - Entry step
	 * @returns The corresponding structure energy
	 */
	getStructureEnergy(step: number): number {

		for(const entry of this.accumulator) {
			if(entry.step === step) {
				return entry.energy;
			}
		}
		return 0;
	}

	/**
	 * Format entry as POSCAR file
	 *
	 * @param step - Entry step
	 * @param pressureFrom - Pressure range start
	 * @param pressureTo - Pressure range end
	 * @returns Content of the POSCAR file
	 */
	entryToPoscar(step: number, pressureFrom: number, pressureTo: number): string {

		let entry;
		for(entry of this.accumulator) {
			if(entry.step === step) {
				break;
			}
		}
		if(!entry) return "";

		const p0 = pressureFrom.toFixed(4);
		const p1 = pressureTo === Infinity ? "up" : pressureTo.toFixed(4);

		let out = "Enthalpy transition structures by STMng. " +
				  `Step: ${entry.step} Pressure range: [${p0}, ${p1}] GPa\n1.0\n`;

		const basisString = Array<string>(9);
		for(let i=0; i < 9; ++i) {
			basisString[i] = entry.basis[i].toFixed(10).padStart(15);
		}

		out += `${basisString[0]} ${basisString[1]} ${basisString[2]}\n`;
		out += `${basisString[3]} ${basisString[4]} ${basisString[5]}\n`;
		out += `${basisString[6]} ${basisString[7]} ${basisString[8]}\n`;

		const species = new Map<number, number>();

		for(const z of entry.atomsZ) {
			const n = species.get(z);
			species.set(z, n ? n+1 : 1);
		}
		out += species.keys().map((z) => getAtomicSymbol(z)).toArray().join(" ") + "\n";
		out += species.values().map((value) => value.toFixed(0)).toArray().join(" ");
		out += "\nDirect\n";

		// Compute inverse matrix
		const inverse = invertBasis(entry.basis);

		for(const atomZ of species.keys()) {
			for(let i=0; i < entry.atomsZ.length; ++i) {

				if(entry.atomsZ[i] !== atomZ) continue;

				const i3 = i*3;
				const cx = entry.atomsPosition[i3];
				const cy = entry.atomsPosition[i3+1];
				const cz = entry.atomsPosition[i3+2];

				const fx = cx*inverse[0] + cy*inverse[3] + cz*inverse[6];
				const fy = cx*inverse[1] + cy*inverse[4] + cz*inverse[7];
				const fz = cx*inverse[2] + cy*inverse[5] + cz*inverse[8];

				out += `${fx.toFixed(10).padStart(15)} ` +
					   `${fy.toFixed(10).padStart(15)} ` +
					   `${fz.toFixed(10).padStart(15)}\n`;
			}
		}

		return out;
	}
}
