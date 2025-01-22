/**
 * Accumulate structures for fingerprint calculation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-07
 */
import {hasNoUnitCell} from "../modules/Helpers";
import type {Structure, BasisType} from "@/types";

/** Essential part of the structure to be accumulated */
export interface StructureReduced {

	/** Index of the structure in the input full set of structures (not selected) */
	id: number;

	/** Unit cell basis vectors */
	basis: BasisType;
	/** The minimum radius to use for the fingerprinting */
	minRadius: number;

	/** Atoms coordinates as [x1, y1, z1, x2, y2, z2, ...] */
	atomsPosition: number[];
	/** Atomic numbers of the structure atoms */
	atomsZ: number[];
	/** Map from atomic number to count of atoms with this atomic number */
	species: Map<number, number>;

	/** If the structure has been selected (by energy) */
	selected: boolean;
	/** Index in the list of selected structures, invalid if selected is false */
	selectedIdx: number;
	/** The structure energy, if any, otherwise undefined */
	energy?: number;

	/** Computed fingerprint for the structure */
	fingerprint: number[];
	/** Number of sections in the fingerprint */
	countSections: number;
	/** Length of each section */
	sectionLength: number;
	/** Computed weights */
	weights: number[];
}

/** Filtering return */
interface FilteringStatus {
	/** Count of selected structures */
	countSelected: number;
	/** Energy threshold to select structures with energy less than it */
	threshold: number;
	/** Error from filtering operation, if any */
	error?: string;
}

/**
 * Accumulate structures for fingerprint calculation.
 */
export class FingerprintsAccumulator {

	private readonly accumulator: StructureReduced[] = [];
	private thresholdEnergy = 0;
	private countSelected = 0;
	private areNanoclusters = false;
	private countSpecies = 0;
	private readonly idx2id = new Map<number, number>();
	private hasEnergies: boolean | undefined = undefined;
	private readonly selectedSteps: number[] = [];

	/**
	 * Add one structure to the accumulator
	 *
	 * @param structure - Structure to be added to the accumulator
	 * @param isNanocluster - If the structure is a nanocluster and not a crystal
	 * @returns True if the loaded structures are nanoclusters
	 * @throws Error.
	 * "Empty structure loaded" or "Number of species differs"
	 */
	add(structure: Structure, isNanocluster: boolean): boolean {

		const {crystal, atoms, extra} = structure;
		const {basis, origin} = crystal;

		// Check structure not empty
		if(atoms.length === 0) throw Error("Empty structure loaded");

		// Check if this structure is a nanocluster because no unit cell
		if(!isNanocluster && hasNoUnitCell(basis)) isNanocluster = true;

		// It is the first structure
		if(this.accumulator.length === 0) this.areNanoclusters = isNanocluster;

		// If there are already accumulated structures
		else if(isNanocluster && !this.areNanoclusters) {
			this.areNanoclusters = true;
			this.recomputeMaxRadius();
		}

		// Check if all structures have energy
		if(this.hasEnergies === undefined || this.hasEnergies) this.hasEnergies = extra.energy !== undefined;

		// Load the structure clone
		const entry: StructureReduced = {

			id: extra.id,

			basis: [
				basis[0], basis[1], basis[2],
				basis[3], basis[4], basis[5],
				basis[6], basis[7], basis[8]
			],
			minRadius: 0,

			atomsPosition: [],
			atomsZ: [],
			species: new Map<number, number>(),

			selected: true,
			selectedIdx: this.accumulator.length,
			energy: extra.energy,

			fingerprint: [],
			countSections: 0,
			sectionLength: 0,

			weights: []
		};

		for(const atom of atoms) {
			const {atomZ, position} = atom;

			if(entry.species.has(atomZ)) {
				const n = entry.species.get(atomZ)!;
				entry.species.set(atomZ, n+1);
			}
			else entry.species.set(atomZ, 1);
			entry.atomsZ.push(atomZ);
			entry.atomsPosition.push(
				position[0] - origin[0],
				position[1] - origin[1],
				position[2] - origin[2]
			);
		}

		// Check all structures have the same number of species
		if(this.countSpecies === 0) this.countSpecies = entry.species.size;
		else if(this.countSpecies !== entry.species.size) throw Error("Number of species differs");

		entry.minRadius = isNanocluster ?
								this.getMaxAtomDistance(entry.atomsPosition) :
								this.getMaxDiagonalLength(basis);

		// Add to the accumulator
		this.accumulator.push(entry);

		// Initialize the mapping between selected structure index and loaded index
		this.idx2id.set(entry.id, entry.id);

		// Put it in the list of selected structures
		this.selectedSteps.push(entry.id);

		return this.areNanoclusters;
	}

	/**
	 * Empty the accumulator
	 */
	clear(): void {
		this.accumulator.length = 0;
		this.idx2id.clear();
		this.hasEnergies = undefined;
		this.selectedSteps.length = 0;
	}

	/**
	 * Count of structures loaded
	 *
	 * @returns - Count of structures loaded
	 */
	size(): number {
		return this.accumulator.length;
	}

	/**
	 * Count of structures loaded and selected
	 *
	 * @returns - Count of the selected structures
	 */
	selectedSize(): number {
		return this.countSelected;
	}

	/**
	 * Check if energies have been loaded
	 *
	 * @returns True if the loaded structures have energies
	 */
	accumulatedHaveEnergies(): boolean {
		return this.hasEnergies ?? false;
	}

	/**
	 * Filter the list of accumulated structures by energy
	 *
	 * @param enableEnergyFiltering - Enable filtering
	 * @param energyThreshold - Energy threshold set by the user
	 * @param thresholdFromMinimum - If the energy threshold is from the structures minimum energy
	 * @returns Count of selected structures, effective energy threshold and eventual error message
	 */
	filterOnEnergy(enableEnergyFiltering: boolean,
				   energyThreshold: number,
				   thresholdFromMinimum: boolean): FilteringStatus {

		// Reload the mapping
		this.idx2id.clear();

		// No energy loaded or no filtering requested
		if(!enableEnergyFiltering || !this.hasEnergies) {

			this.selectedSteps.length = 0;
			let idx = 0;
			for(const structure of this.accumulator) {
				structure.selected = true;
				structure.selectedIdx = idx++;
				this.idx2id.set(structure.id, structure.id);
				this.selectedSteps.push(structure.id);
			}
			this.countSelected = this.accumulator.length;
			return {
				countSelected: this.countSelected,
				threshold: energyThreshold
			};
		}

		// Compute energy threshold
		if(thresholdFromMinimum) {

			let min = Number.POSITIVE_INFINITY;
			for(const structure of this.accumulator) {
				if(structure.energy! < min) min = structure.energy!;
			}
			this.thresholdEnergy = min + energyThreshold;
		}
		else {
			this.thresholdEnergy = energyThreshold;
		}

		// Select structures with energy less than the threshold
		let countSelected = 0;
		this.selectedSteps.length = 0;
		const len = this.accumulator.length;
		let j = 0;
		for(let i = 0; i < len; ++i) {
			if(this.accumulator[i].energy! <= this.thresholdEnergy) {
				++countSelected;
				this.accumulator[i].selected = true;
				this.accumulator[i].selectedIdx = j;
				this.idx2id.set(j++, i);
				this.selectedSteps.push(this.accumulator[i].id);

			}
			else this.accumulator[i].selected = false;
		}
		this.countSelected = countSelected;

		return {
			countSelected,
			threshold: this.thresholdEnergy
		};
	}

	/**
	 * Returns filtering values
	 *
	 * @returns Count of selected structures and the effective energy threshold
	 */
	filtered(): FilteringStatus {
		return {
			countSelected: this.countSelected,
			threshold: this.thresholdEnergy
		};
	}

	/**
	 * Iterator on the selected structures
	 *
	 * @returns An iterator on the selected structures
	 */
	* iterateSelectedStructures(): Generator<StructureReduced> {

		for(const entry of this.accumulator) {
			if(entry.selected) {
				yield entry;
			}
		}
	}

	/**
	 * Iterator on selected structure pairs
	 *
	 * @returns An iterator on selected structure pairs
	 */
	* iterateSelectedStructurePairs(): Generator<[StructureReduced, StructureReduced]> {

		for(let i=0; i < this.accumulator.length-1; ++i) {
			if(!this.accumulator[i].selected) continue;
			for(let j=i+1; j < this.accumulator.length; ++j) {
				if(!this.accumulator[j].selected) continue;

				yield [this.accumulator[i], this.accumulator[j]];
			}
		}
	}

	/**
	 * Get unit cell longest diagonal
	 *
	 * @param basis - Structure basis vectors
	 * @returns Unit cell longest diagonal
	 */
	private getMaxDiagonalLength(basis: BasisType): number {

		// First diagonal: a+b+c
		let dx = basis[0] + basis[3] + basis[6];
		let dy = basis[1] + basis[4] + basis[7];
		let dz = basis[2] + basis[5] + basis[8];
		let len = dx*dx+dy*dy+dz*dz;
		let maxBasisLen = len;

		// Second diagonal: a-b+c
		dx = basis[0] - basis[3] + basis[6];
		dy = basis[1] - basis[4] + basis[7];
		dz = basis[2] - basis[5] + basis[8];
		len = dx*dx+dy*dy+dz*dz;
		if(len > maxBasisLen) maxBasisLen = len;

		// Third diagonal: a-b-c
		dx = basis[0] - basis[3] - basis[6];
		dy = basis[1] - basis[4] - basis[7];
		dz = basis[2] - basis[5] - basis[8];
		len = dx*dx+dy*dy+dz*dz;
		if(len > maxBasisLen) maxBasisLen = len;

		// Forth diagonal: a+b-c
		dx = basis[0] + basis[3] - basis[6];
		dy = basis[1] + basis[4] - basis[7];
		dz = basis[2] + basis[5] - basis[8];
		len = dx*dx+dy*dy+dz*dz;
		if(len > maxBasisLen) maxBasisLen = len;

		// Return the maximum value
		return Math.sqrt(maxBasisLen);
	}

	/**
	 * Get maximum atom distance when the structure is a nanocluster
	 *
	 * @param atoms - List of structure atoms
	 * @returns Max distance between structure atoms
	 */
	private getMaxAtomDistance(atomsPosition: number[]): number {

		let maxAtomDistance = 0;

		const natoms = atomsPosition.length / 3;
		for(let i=0; i < natoms-1; ++i) {

			const i3 = i*3;
			const ix = atomsPosition[i3];
			const iy = atomsPosition[i3+1];
			const iz = atomsPosition[i3+2];

			for(let j=i+1; j < natoms; ++j) {

				const j3 = j*3;
				const jx = atomsPosition[j3];
				const jy = atomsPosition[j3+1];
				const jz = atomsPosition[j3+2];
				const dx = ix - jx;
				const dy = iy - jy;
				const dz = iz - jz;

				const len = dx*dx+dy*dy+dz*dz;
				if(len > maxAtomDistance) maxAtomDistance = len;
			}
		}

		// Return the maximum value
		return Math.sqrt(maxAtomDistance);
	}

	/**
	 * Get the minimum cutoff radius for fingerprint calculation
	 *
	 * @returns Minimum cutoff radius for all structures
	 */
	getCutoffDistance(): number {

		let diameter = 0;

		// Compute the minimum radius to use for the fingerprinting
		for(const structure of this.accumulator) {

			if(structure.selected) {
				const {minRadius} = structure;
				if(minRadius > diameter) diameter = minRadius;
			}
		}

		// Return the cutoff distance (adding a 2% security margin)
		// return (diameter / 2) * 1.02;
		return diameter * 0.51;
	}

	/**
	 * If the nanocluster status changes mid-accumulation, recompute the min cutoff radius
	 */
	private recomputeMaxRadius(): void {

		for(const structure of this.accumulator) {
			structure.minRadius = this.areNanoclusters ?
										this.getMaxAtomDistance(structure.atomsPosition) :
										this.getMaxDiagonalLength(structure.basis);
		}
	}

	/**
	 * Return info on the sections
	 *
	 * @returns Section count and section length
	 */
	getSectionsInfo(): {count: number; length: number; error?: string} {

		let count = 0;
		let length = 0;

		for(const entry of this.accumulator) {
			if(entry.selected) {

				const cc = entry.countSections;
				if(count === 0) count = cc;
				else if(cc !== count) return {count: 0, length: 0, error: "Inconsistent section count"};

				const ll = entry.sectionLength;
				if(length === 0) length = ll;
				else if(ll !== length) return {count: 0, length: 0, error: "Inconsistent section length"};
			}
		}
		return {count, length};
	}

	/**
	 * Return selected structures step number
	 *
	 * @returns List of all selected structure steps numbers
	 */
	getSelectedStepsIds(): number[] {

		return this.selectedSteps;
	}

	/**
	 * Return a fingerprint
	 *
	 * @param requestedIdx - Index in the list of selected structures
	 * @returns The fingerprint of the selected structure
	 */
	getFingerprint(requestedIdx: number): number[] {

		let idx = 0;
		for(const entry of this.accumulator) {
			if(entry.selected) {
				if(idx === requestedIdx) return entry.fingerprint;
				++idx;
			}
		}
		return [];
	}
}
