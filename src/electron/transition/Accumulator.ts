/**
 * Accumulate structures for enthalpy transition calculation.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-04-23
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
import {hasNoUnitCell} from "../modules/Helpers";
import {getAtomicSymbol} from "../modules/AtomData";
import type {BasisType, Structure} from "@/types";

/**
 * One entry of the accumulator
 */
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

/**
 * Accumulate structures for enthalpy transitions computation
 */
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
	 * Get an entry
	 *
	 * @param idx - Index of the requested entry
	 * @returns The corresponding entry
	 */
	getEntry(idx: number): Entry {
		return this.accumulator[idx];
	}
}
