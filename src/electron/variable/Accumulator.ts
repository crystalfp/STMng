/**
 * Accumulate structures for variable composition calculation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-01-20
 */
import {getAtomicSymbol} from "../modules/AtomData";
import {hasNoUnitCell} from "../modules/Helpers";
import type {Structure, BasisType} from "@/types";

/**
 * Content of the entries of the accumulator
 */
export interface VariableComponent {

	/** If the structure is to consider after reducing to one for group */
	enabled: boolean;
	/** Index of the structure in the input full set of structures (not selected) */
	step: number;
	/** The structure energy, if any, otherwise undefined */
	energy?: number;

	/** Unit cell basis vectors */
	basis: BasisType;
	/** Atoms coordinates as [x1, y1, z1, x2, y2, z2, ...] */
	atomsPosition: number[];
	/** Atomic numbers of the structure atoms */
	atomsZ: number[];
	/** Map from atomic number to count of atoms with this atomic number */
	species: Map<number, number>;

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
export class VariableCompositionAccumulator {

	private readonly accumulator: VariableComponent[] = [];
	private allHaveEnergies: boolean | undefined = undefined;
	private readonly allSpecies = new Set<number>();
	private readonly keyMap = new Map<string, number[]>();
	private numberOfComponents = 0;

	/**
	 * Load a structure
	 *
	 * @param structure - Structure to be accumulated
	 */
	add(structure: Structure): void {

		const {crystal, atoms, extra} = structure;
		const {basis, origin} = crystal;

		// Check structure not empty
		if(atoms.length === 0) throw Error("Empty structure loaded");
		if(hasNoUnitCell(basis)) throw Error("Structure has no unit cell");

		// Check if all structures have energy
		if(this.allHaveEnergies === undefined || this.allHaveEnergies) {
			this.allHaveEnergies = extra.energy !== undefined;
		}

		const entry: VariableComponent = {

			enabled: true,
			step: extra.step,
			energy: extra.energy,

			basis: [
				basis[0], basis[1], basis[2],
				basis[3], basis[4], basis[5],
				basis[6], basis[7], basis[8]
			],
			atomsPosition: [],
			atomsZ: [],
			species: new Map<number, number>(),
			parts: [],
			key: "",
			distance: 0,

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
		this.allHaveEnergies = undefined;
		this.keyMap.clear();
		this.numberOfComponents = 0;
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
	 * @returns All accumulated species Z value
	 */
	species(): number[] {

		return [...this.allSpecies];
	}

	/**
	 * Iterator on the accumulated structures
	 *
	 * @returns An iterator on the selected structures
	 */
	* iterateStructures(): Generator<VariableComponent> {

		for(const entry of this.accumulator) {
			yield entry;
		}
	}

	/**
	 * Iterator on the accumulated structures that are enabled
	 *
	 * @returns An iterator on the enabled structures
	 */
	* iterateEnabledStructures(): Generator<VariableComponent> {

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
	getEntry(idx: number): VariableComponent | undefined {
		if(idx < 0 || idx >= this.accumulator.length) return undefined;
		return this.accumulator[idx];
	}

	/**
	 * Check if structures have energies
	 *
	 * @returns True if structures have energies
	 */
	hasEnergies(): boolean {
		return this.allHaveEnergies ?? false;
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
	 * Save the number of components
	 *
	 * @param n - Number of component (set to zero if distances not loaded)
	 */
	setNumberOfComponents(n: number): void {
		this.numberOfComponents = n;
	}

	/**
	 * Get the number of components
	 *
	 * @returns Number of components or zero if no distance loaded
	 */
	getNumberOfComponents(): number {
		return this.numberOfComponents;
	}

	/**
	 * Set structure distance from the convex hull
	 *
	 * @param distances - Distances from the convex hull as computed in prepareData
	 */
	setDistances(distances: number[] | undefined): void {

		if(!distances) {
			this.numberOfComponents = 0;
			return;
		}
		let idx = 0;
		for(const entry of this.accumulator) {
			if(entry.enabled) {
				entry.distance = distances[idx++];
			}
		}
	}
}
