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
import {getAtomicSymbol} from "./AtomData";

/** Selected atoms positions */
interface Positions {
	/** Selected atoms coordinates */
	positions: PositionType[];
	/** Their indices inside the structure */
	idx: number[];
}

/** Distance computation result */
interface Distance {
	/** Distance between the atoms */
	distance: number;
	/** Offset added to remove jumps between sides of the unit cell */
	offset: PositionType;
}

/** Values for the greedy algorithm to find correspondences */
interface Cost {
	/** Index of the previous step atom */
	initial: number;
	/** Index of the current step atom */
	final: number;
	/** Distance between the atoms */
	cost: number;
	/** Offset eventually added to cancel jump */
	offset: PositionType;
}

interface Averages {
	position: PositionType;
	count: number;
	displacement: number;
	atomZ: number;
}
interface AveragesResult {
	position: PositionType;
	displacement: number;
	atomType: string;
	index: number;
}

/** Adjust position of atoms to reduce non-physical movements */
export class ReorderAtomsInSteps {

	private previousStep = new Map<number, Positions>();
	private currentStep = new Map<number, Positions>();
	private basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	private hasUnitCell = false;

	private readonly averages = new Map<number, Averages>();

	/**
	 * Initialize the algorithm
	 */
	init(): void {
		this.previousStep.clear();
		this.currentStep.clear();
		this.basis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		this.hasUnitCell = false;
		this.averages.clear();
	}

	/**
	 * Load a step and transform it
	 *
	 * @param structure - Structure at the given step
	 * @param indices - Indices of selected atoms in the structure
	 * @returns The updated positions and reordered indices for the loaded step
	 */
	loadStep(structure: Structure, indices: number[]): AveragesResult[] {
console.log("--- LOAD");

		// The first step saves the position and returns it unchanged
		if(this.previousStep.size === 0) {
console.log("FIRST");

			this.loadCurrentStep(structure, indices);

			for(const specie of this.currentStep.values()) {
console.log("species", specie);
				for(let i=0; i < specie.positions.length; ++i) {

					const pp = specie.positions[i];
					const idx = specie.idx[i];

					this.averages.set(idx, {
						position: [...pp],
						count: 1,
						displacement: 0,
						atomZ: structure.atoms[idx].atomZ
					});
				}
			}
console.log("END FIRST");
		}
		else {
console.log("NEXT");

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
console.log("entry", entry);

				if(entry.idx.length === 1) {

					if(this.averages.has(entry.idx[0])) {
						const avg = this.averages.get(entry.idx[0])!;
						const pp: PositionType = [
							avg.position[0] + entry.positions[0][0],
							avg.position[1] + entry.positions[0][1],
							avg.position[2] + entry.positions[0][2]
						];
						const count = avg.count + 1;
						const dx = pp[0]/count - entry.positions[0][0];
						const dy = pp[1]/count - entry.positions[0][1];
						const dz = pp[2]/count - entry.positions[0][2];
						const displacement = dx*dx + dy*dy + dz*dz + avg.displacement;

						this.averages.set(entry.idx[0], {
							position: pp,
							count,
							displacement,
							atomZ: structure.atoms[entry.idx[0]].atomZ
						});
					}
					else {
						this.averages.set(entry.idx[0], {
							position: [...entry.positions[0]],
							count: 1,
							displacement: 0,
							atomZ: structure.atoms[entry.idx[0]].atomZ
						});
					}
				}
				else {

					const cost = this.computeCostArray(this.previousStep.get(specie)!.positions,
											   		   entry.positions);

  					// Sort by cost (greedy approach)
  					cost.sort((a, b) => a.cost - b.cost);

  					// Assign greedily
					const n = this.previousStep.get(specie)!.positions.length;
					const assignment = Array<number>(n).fill(-1);
					const usedFinalPositions = new Set<number>();
  					for(const assign of cost) {
						if(assignment[assign.initial] === -1 && !usedFinalPositions.has(assign.final)) {
							assignment[assign.initial] = assign.final;
							usedFinalPositions.add(assign.final);
						}
					}

					// Reorder values
					// TBD
					for(const entry of assignment) {
						console.log(entry, "->", assignment[entry]);
					}
				}
			}
		}

		return this.prepareResults();
	}

	/**
	 * Format the average position and displacement
	 *
	 * @returns Formatted accumulated results
	 */
	private prepareResults(): AveragesResult[] {

		const results: AveragesResult[] = [];

		for(const index of this.averages.keys()) {

			const entry = this.averages.get(index)!;

			const avgEntry: AveragesResult = {
				position: [entry.position[0]/entry.count,
						   entry.position[1]/entry.count,
						   entry.position[2]/entry.count],
				displacement: entry.displacement/entry.count,
				atomType: getAtomicSymbol(entry.atomZ),
				index
			};

			results.push(avgEntry);
		}

		return results;
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
