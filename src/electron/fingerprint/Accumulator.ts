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

	index: number;

	basis: BasisType;
	minRadius: number;

	atomsPosition: number[];
	atomsZ: number[];
	species: Map<number, number>;

	selected: boolean;

	fingerprint: number[];
	weights: number[];
}

/** Filtering return */
interface FilteringStatus {
	countSelected: number;
	threshold: number;
	error?: string;
}

export class FingerprintsAccumulator {

	private readonly accumulator: StructureReduced[] = [];
	private readonly energyPerStructure: number[] = [];
	private thresholdEnergy = 0;
	private countSelected = 0;
	private areNanoclusters = false;
	private countSpecies = 0;

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

		const {crystal, atoms} = structure;
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

		// Load the structure clone
		const entry: StructureReduced = {

			index: this.accumulator.length,

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

			fingerprint: [],
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
					this.getMaxAtomDistance(entry.atomsPosition) : this.getMaxDiagonalLength(basis);

		this.accumulator.push(entry);

		return this.areNanoclusters;
	}

	/**
	 * Empty the accumulator
	 */
	clear(): void {
		this.accumulator.length = 0;
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
	 * Count of species in the loaded structures
	 *
	 * @returns - Count of species
	 */
	numberOfSpecies(): number {
		return this.countSpecies;
	}

	/**
	 * Load the list of energies per structure
	 *
	 * @param energies - Energies per structure
	 */
	loadEnergies(energies: number[]): void {

		this.energyPerStructure.length = energies.length;
		for(let i = 0; i < energies.length; ++i) this.energyPerStructure[i] = energies[i];
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

		// No energy loaded or no filtering requested
		if(!enableEnergyFiltering || this.energyPerStructure.length === 0) {

			for(const structure of this.accumulator) structure.selected = true;
			this.countSelected = this.accumulator.length;
			return {
				countSelected: this.countSelected,
				threshold: energyThreshold
			};
		}

		// Compute energy threshold
		if(thresholdFromMinimum) {
			const cnt = this.accumulator.length;
			if(cnt > this.energyPerStructure.length) {
				this.countSelected = 0;
				return {
					countSelected: 0,
					threshold: 0,
					error: "Energies are less than structures"
				};
			}
			let min = this.energyPerStructure[0];
			for(let i = 1; i < cnt; ++i) {
				if(this.energyPerStructure[i] < min) min = this.energyPerStructure[i];
			}
			this.thresholdEnergy = min + energyThreshold;
		}
		else {
			this.thresholdEnergy = energyThreshold;
		}

		// Select structures with energy less than the threshold
		let countSelected = 0;
		const len = this.accumulator.length;
		for(let i = 0; i < len; ++i) {
			if(this.energyPerStructure[i] <= this.thresholdEnergy) {
				++countSelected;
				this.accumulator[i].selected = true;
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
}
