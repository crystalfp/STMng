/**
 * Reorder atoms between steps to minimize their displacements
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-15
 */
import type {Structure, PositionType, BasisType} from "@/types";
import {hasUnitCell} from "./Helpers";

interface Positions {
	positions: PositionType[];
	idx: number[];
}

interface Distance {
	distance: number;
	offset: PositionType;
}

interface Cost {
	initial: number;
	final: number;
	cost: number;
	offset: PositionType;
}

export class ReorderAtomsInSteps {

	private previousStep = new Map<number, Positions>();
	private currentStep = new Map<number, Positions>();
	private basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	private hasUnitCell = false;

	/**
	 * Initialize the algorithm
	 */
	init(): void {
		this.previousStep.clear();
		this.currentStep.clear();
		this.basis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		this.hasUnitCell = false;
	}

	/**
	 * Load a new step
	 *
	 * @param structure - Structure at the given step
	 * @param indices - Indices of selected atoms
	 * @returns The updated positions and indices for the loaded step
	 */
	loadStep(structure: Structure, indices: number[]): Positions {

		const updatedPositions: Positions = {positions: [], idx: []};

		// The first step saves the position and returns it
		if(this.previousStep.size === 0) {

			this.loadCurrentStep(structure, indices);

			for(const specie of this.currentStep.values()) {

				for(const pp of specie.positions) {
					updatedPositions.positions.push(pp);
				}
				for(const idx of specie.idx) {
					updatedPositions.idx.push(idx);
				}
			}
		}
		else {

			// Move current step to previous step
			this.previousStep.clear();
			this.previousStep = this.currentStep;
			this.currentStep.clear();

			// Load current step
			this.loadCurrentStep(structure, indices);

			// For each specie analyze the differences
			for(const specie of this.currentStep.keys()) {

				const entry = this.currentStep.get(specie);
				if(!entry) continue;

				if(entry.idx.length === 1) {
					updatedPositions.positions.push(entry.positions[0]);
					updatedPositions.idx.push(entry.idx[0]);
				}
				else {

					const cost = this.computeCostArray(this.previousStep.get(specie)!.positions,
											   		   entry.positions);

  					// Sort by cost (greedy approach)
  					cost.sort((a, b) => a.cost - b.cost);
				}

				for(const pp of entry.positions) { // TBD
					updatedPositions.positions.push(pp);
				}
				for(const idx of entry.idx) {
					updatedPositions.idx.push(idx);
				}
			}
		}

		return updatedPositions;
	}

	/**
	 * Load current step atoms' positions
	 *
	 * @param structure - Structure at the given step
	 * @param indices - Indices of selected atoms
	 */
	private loadCurrentStep(structure: Structure, indices: number[]): void {

		this.basis = structure.crystal.basis;
		this.hasUnitCell = hasUnitCell(this.basis);
		for(const idx of indices) {
			const atom = structure.atoms[idx];
			const entry = this.currentStep.get(atom.atomZ);
			if(entry) {
				entry.positions.push(atom.position);
				entry.idx.push(idx);
			}
			else {
				this.currentStep.set(atom.atomZ, {positions: [atom.position], idx: [idx]});
			}
		}
	}

	/**
	 * Distance between two atoms
	 *
	 * @param p1 - Position of one atom of the previous step
	 * @param p2 - Position of one atom of the current step
	 * @returns Distance and offset added between the two atoms
	 */
	private computeDistance(p1: PositionType, p2: PositionType): Distance {

		if(this.hasUnitCell) {
			let distance = Number.POSITIVE_INFINITY;
			let offset: PositionType = [0, 0, 0];

			for(let ia = -1; ia <= 1; ++ia) {
				for(let ib = -1; ib <= 1; ++ib) {
					for(let ic = -1; ic <= 1; ++ic) {

						// d = p1 - (p2 + ia*a + ib*b + ic*c)
						const bx = ia*this.basis[0] + ib*this.basis[3] + ic*this.basis[6];
						const by = ia*this.basis[1] + ib*this.basis[4] + ic*this.basis[7];
						const bz = ia*this.basis[2] + ib*this.basis[5] + ic*this.basis[8];

						const dx = p1[0] - p2[0] - bx;
						const dy = p1[1] - p2[1] - by;
						const dz = p1[2] - p2[2] - bz;
						const d = Math.hypot(dx, dy, dz);
						if(d < distance) {
							distance = d;
							offset = [bx, by, bz];
						}
					}
				}
			}
			return {distance, offset};
		}

		const dx = p1[0] - p2[0];
		const dy = p1[1] - p2[1];
		const dz = p1[2] - p2[2];
		const distance = Math.hypot(dx, dy, dz);
		return {distance, offset: [0, 0, 0]};
	}

	private computeCostArray(points1: PositionType[], points2: PositionType[]): Cost[] {

		const costArray: Cost[] = [];

		for(let ia = 0; ia < points1.length; ++ia) {

			const p1 = points1[ia];

			for(let ib = 0; ib < points2.length; ++ib) {

				const p2 = points2[ib];
				const distance = this.computeDistance(p1, p2);
				costArray.push({
					initial: ia,
					final: ib,
					cost: distance.distance,
					offset: distance.offset
				});
			}
		}

		return costArray;
	}
}
