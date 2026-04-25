/**
 * Accumulate structures for enthalpy transition calculation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-23
 */
import type {BasisType, Structure} from "@/types";
import {hasNoUnitCell, invertBasis} from "../modules/Helpers";
import {getAtomicSymbol} from "../modules/AtomData";

interface Entry {

	/** Step of the structure in the input full set of structures */
	step: number;
	/** The per structure energy */
	energy: number;
	/** Cell volume */
	volume: number;

	/** The per atom energy */
	energyPerAtom: number;
	/** Unit cell basis vectors */
	basis: BasisType;
	/** Atoms coordinates as [x1, y1, z1, x2, y2, z2, ...] */
	atomsPosition: number[];
	/** Atomic numbers of the structure atoms */
	atomsZ: number[];
}

export class EnthalpyTransitionAccumulator {

	private readonly accumulator: Entry[] = [];

	/**
	 * Empty the accumulator
	 */
	clear(): void {
		this.accumulator.length = 0;
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
	 * @param structure - Structure to add to the accumulator
	 * @returns Error message or empty string on success
	 */
	add(structure: Structure): string {

		if(structure.atoms.length === 0) return "Empty structure loaded";

		const {basis} = structure.crystal;
		if(hasNoUnitCell(basis)) return "Structure has no unit cell";

		const {step, energy} = structure.extra;
		if(energy === undefined) return "Structure has no energy";

		const entry: Entry = {
			step,
			energy,
			energyPerAtom: energy,
			volume: this.getCellVolume(basis),
			basis: [
				basis[0], basis[1], basis[2],
				basis[3], basis[4], basis[5],
				basis[6], basis[7], basis[8]
			],
			atomsPosition: [],
			atomsZ: []
		};

		for(const {atomZ, position} of structure.atoms) {
			entry.atomsZ.push(atomZ);
			entry.atomsPosition.push(...position);
		}
		entry.energy *= structure.atoms.length;

		this.accumulator.push(entry);

		return "";
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
	 * Prepare points for the convex hull
	 *
	 * @returns List of points [volume, energy] for the convex hull routine
	 */
	getEnvelopePoints(): number[][] {

		const out: number[][] = [];
		for(const entry of this.accumulator) {
			out.push([entry.volume, entry.energy]);
		}
		return out;
	}

	/**
	 * Get formula
	 *
	 * @param idx - Index of the requested entry
	 * @returns The formula as HTML string
	 */
	getFormula(idx: number): string {

		let formula = "";
		const counts = new Map<number, number>();
		for(const atom of this.accumulator[idx].atomsZ) {
			const n = counts.get(atom);
			counts.set(atom, n ? n+1 : 1);
		}

		for(const [k, v] of counts) {

			formula += getAtomicSymbol(k);
			if(v > 1) formula += `<sub>${v}</sub>`;
		}
		return formula;
	}

	/**
	 * Get structure step
	 *
	 * @param idx - Index of the requested entry
	 * @returns The corresponding step in the input sequence
	 */
	getStep(idx: number): number {
		return this.accumulator[idx].step;
	}

	/**
	 * Get structure energy
	 *
	 * @param idx - Index of the requested entry
	 * @returns The corresponding structure energy
	 */
	getStructureEnergy(idx: number): number {
		return this.accumulator[idx].energy;
	}
/*
	computeIntersections(): {points: number[][]; pairs: number[][]} {

		const intersections: number[][] = [];
		const idxIntersections: number[][] = [];
		const len = this.accumulator.length;
		for(let i=0; i < len-1; ++i) {

			const {energy: ei, volume: vi} = this.accumulator[i];

			for(let j=i+1; j < len; ++j) {

				const {energy: ej, volume: vj} = this.accumulator[j];

				const p = (ei-ej)/(vj-vi);
				if(p < 0) continue;
				const e = ej+p*vj;

				intersections.push([p, e]);
				idxIntersections.push([i, j]);
			}
		}

		return {points: intersections, pairs: idxIntersections};
	}*/

	/**
	 * Format entry as POSCAR file
	 *
	 * @param entry - One composition to convert to POSCAR
	 * @returns Content of the POSCAR file
	 */
	entryToPoscar(idx: number, pressure: number): string {

		const entry = this.accumulator[idx];

		let out = "Enthalpy transition structures by STMng. " +
				  `Step: ${entry.step} Pressure: ${pressure.toFixed(4)} GPa\n1.0\n`;

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
