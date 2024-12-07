/**
 * Accumulate structures for fingerprint calculation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-12-07
 */
import type {Structure, PositionType, BasisType} from "@/types";

/** Essential part of the structure to be accumulated */
interface StructureReduced {
	crystal: {
		origin: PositionType;
		basis: BasisType;
	};
	atoms: {
    	atomZ: number;
	    position: PositionType;
	}[];
	bonds: {
    	from: number;
	    to: number;
	    type: 0 | 1 | 99;
	}[];
	selected: boolean;
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

	/**
	 * Add one structure to the accumulator
	 *
	 * @param structure - Structure to be added to the accumulator
	 */
	add(structure: Structure): void {

		const {crystal, atoms, bonds} = structure;
		const {basis, origin} = crystal;

		const entry: StructureReduced = {
			crystal: {
				basis: [
					basis[0], basis[1], basis[2],
					basis[3], basis[4], basis[5],
					basis[6], basis[7], basis[8]
				],
				origin: [
					origin[0],
					origin[1],
					origin[2]
				]
			},
			atoms: [],
			bonds: [],
			selected: true
		};

		for(const atom of atoms) {
			entry.atoms.push({
				atomZ: atom.atomZ,
				position: [
					atom.position[0],
					atom.position[1],
					atom.position[2]
				]
			});
		}

		for(const bond of bonds) {
			entry.bonds.push({
				from: bond.from,
				to: bond.to,
				type: bond.type
			});
		}

		this.accumulator.push(entry);
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
	 * Load the list of energies per structure
	 *
	 * @param energies - Energies per structure
	 */
	loadEnergies(energies: number[]): void {

		this.energyPerStructure.length = energies.length;
		for(let i = 0; i < energies.length; ++i) this.energyPerStructure[i] = energies[i];
	}

	/**
	 * Filter the list of accumulated structure by energy
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
}
