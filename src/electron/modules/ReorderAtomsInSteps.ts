/**
 * Reorder atoms between steps to minimize their displacements
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-06-15
 */
import type {Structure, Atom, PositionType, BasisType} from "@/types";
import {cartesianToFractionalCoordinates, hasUnitCell} from "./Helpers";
import {getAtomicSymbol} from "./AtomData";
import {EmptyStructure} from "./EmptyStructure";

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
	/** Index of the previous step atom (same specie) */
	initial: number;
	/** Index of the current step atom (same specie) */
	final: number;
	/** Distance between the atoms */
	cost: number;
	/** Offset eventually added to cancel jump */
	offset: PositionType;
}

/** Accumulated values to compute averages */
interface Averages {
	/** Accumulated positions */
	meanPosition: PositionType;
	/** Accumulated steps count */
	count: number;
	/** Accumulated squared displacements */
	squaredDisplacement: number;
	/** Corresponding atom type */
	atomZ: number;
	/** Corresponding atom index */
	idx: number;
	/** Sequence number in the same specie set of atoms */
	seq: number;
}

/** Computed average positions and displacements */
export interface AveragesResult {
	/** Mean position */
	position: PositionType;
	/** Mean squared displacement */
	displacement: number;
	/** Corresponding atom symbol */
	atomType: string;
	/** Corresponding atom Z value */
	atomZ: number;
	/** Corresponding atom index */
	index: number;
	/** True if position is in fractional coordinates */
	isFractional: boolean;
}

interface AverageResultsAndStructure {
	averages: AveragesResult[];
	structure: Structure;
}

/** Adjust position of atoms to reduce non-physical movements */
export class ReorderAtomsInSteps {

	/** Key is atomZ */
	private previousStep = new Map<number, Positions>();
	private currentStep = new Map<number, Positions>();
	private basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	private hasUnitCell = false;

	private readonly averages: Averages[] = [];

	private averageBasis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	private steps = 0;

	/**
	 * Initialize the algorithm
	 */
	init(): void {

		this.previousStep.clear();
		this.currentStep.clear();
		this.basis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		this.hasUnitCell = false;
		this.averages.length = 0;

		this.averageBasis = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		this.steps = 0;
	}

	/**
	 * Load a step and transform it
	 *
	 * @param structure - Structure at the given step
	 * @param indices - Indices of selected atoms in the structure
	 * @returns The updated positions and reordered indices for the loaded step
	 */
	loadStep(structure: Structure, indices: number[]): AverageResultsAndStructure {

		// Sanity check
		if(indices.length === 0) return {averages: [], structure: new EmptyStructure()};

		// The first step saves the position and returns it unchanged
		if(this.currentStep.size === 0) {

			this.loadCurrentStep(structure, indices);

			for(const specie of this.currentStep) {

				for(let i=0; i < specie[1].positions.length; ++i) {

					const pp = specie[1].positions[i];
					const idx = specie[1].idx[i];

					this.averages.push({
						meanPosition: [...pp],
						count: 1,
						squaredDisplacement: 0,
						atomZ: specie[0],
						idx,
						seq: i
					});
				}
			}
		}
		else {

			// Move current step to previous step
			this.previousStep.clear();
			this.previousStep = new Map<number, Positions>(this.currentStep);
			this.currentStep.clear();

			// Load current step
			this.loadCurrentStep(structure, indices);

			// For each specie analyze the differences
			for(const specie of this.currentStep) {

				const cost = this.computeCostArray(this.previousStep.get(specie[0])!.positions,
												   specie[1].positions);

				// Sort by cost (greedy approach)
				cost.sort((a, b) => a.cost - b.cost);

				// Assign greedily
				const np = this.previousStep.get(specie[0])!.positions.length;
				const pairedPrevious = Array<number>(np).fill(-1);
				const nc = specie[1].positions.length;
				const pairedCurrent = Array<number>(nc).fill(-1);
				let n = Math.min(np, nc);
				const paired = new Map<number, number>();

				for(let i=0; i < cost.length; ++i) {
					const previous = cost[i].initial;
					const current = cost[i].final;
					if(pairedPrevious[previous] === -1 && pairedCurrent[current] === -1) {
						pairedPrevious[previous] = i;
						pairedCurrent[current] = i;
						paired.set(previous, current);
						--n;
						if(n === 0) break;
					}
				}

				// Reorder values
				for(const pair of paired) {

					const previous = pair[0];
					const current = pair[1];

					const currentIdx = this.currentStep.get(specie[0])!.idx[current];

					for(const avg of this.averages) {
						if(avg.seq === previous && avg.atomZ === specie[0]) {
							const {offset} = cost[pairedPrevious[previous]];
							const position =
								this.currentStep.get(specie[0])!.positions[current];
							const pp: PositionType = [
								avg.meanPosition[0] + position[0] - offset[0],
								avg.meanPosition[1] + position[1] - offset[1],
								avg.meanPosition[2] + position[2] - offset[2]
							];
							const count = avg.count + 1;
							const dx = pp[0]/count - position[0] + offset[0];
							const dy = pp[1]/count - position[1] + offset[1];
							const dz = pp[2]/count - position[2] + offset[2];
							const displacement = dx*dx + dy*dy + dz*dz + avg.squaredDisplacement;

							avg.meanPosition = pp;
							avg.count = count;
							avg.squaredDisplacement = displacement;
							avg.idx = currentIdx;
							break;
						}
					}
				}
			}
		}

		// Prepare results
		const results = this.prepareResults();
		const outStructure = this.prepareMeanStructure(results, structure);

		return {averages: results, structure: outStructure};
	}

	/**
	 * Format the average position and displacement
	 *
	 * @returns Formatted accumulated results
	 */
	private prepareResults(): AveragesResult[] {

		const results: AveragesResult[] = [];

		for(const avg of this.averages) {

			const avgEntry: AveragesResult = {
				position: [avg.meanPosition[0]/avg.count,
						   avg.meanPosition[1]/avg.count,
						   avg.meanPosition[2]/avg.count],
				displacement: avg.squaredDisplacement/avg.count,
				atomType: getAtomicSymbol(avg.atomZ),
				atomZ: avg.atomZ,
				index: avg.idx,
				isFractional: false
			};

			results.push(avgEntry);
		}

		return results;
	}

	/**
	 * Compute mean structure and convert positions to fractional
	 *
	 * @param results - Average positions for this step
	 * @param inputStructure - Step input structure
	 * @returns Average structure
	 */
	prepareMeanStructure(results: AveragesResult[], inputStructure: Structure): Structure {

		const atoms: Atom[] = [];

		for(const entry of results) {
			atoms.push({
				atomZ: entry.atomZ,
				label: entry.atomType,
				chain: "",
				position: [entry.position[0], entry.position[1], entry.position[2]],
			});
		}
		const basis: BasisType = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		if(this.steps > 0) {
			for(let i=0; i < 9; ++i) basis[i] = this.averageBasis[i]/this.steps;
		}

		const structure: Structure = {
			crystal: {
				basis,
				origin: [0, 0, 0],
				spaceGroup: inputStructure.crystal.spaceGroup
			},
			atoms,
			bonds: [],
			volume: [],
			extra: inputStructure.extra
		};

		if(this.steps > 0) {

			const fc = cartesianToFractionalCoordinates(structure);

			let idx = 0;
			for(const entry of results) {

				entry.position[0] = fc[idx++];
				entry.position[1] = fc[idx++];
				entry.position[2] = fc[idx++];
				entry.isFractional = true;
			}
		}

		return structure;
	}

	/**
	 * Load current step atoms' positions
	 *
	 * @param structure - Structure at the given step
	 * @param indices - Indices of the atoms selected
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

		if(this.hasUnitCell) {
			for(let i=0; i < 9; ++i) this.averageBasis[i] += this.basis[i];
			++this.steps;
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

	/**
	 * Compute the cost array
	 *
	 * @param points1 - Atoms positions in the previous step
	 * @param points2 - Atoms positions in the current step
	 * @returns - Cost array to be reordered to find atoms correspondences
	 */
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
