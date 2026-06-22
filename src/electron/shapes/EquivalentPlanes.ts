/**
 * Mark equivalent planes based on symmetry
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-19
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import log from "electron-log";
import {multiply, inv} from "mathjs";
import {getSeitzRotations} from "../modules/NativeFunctions";
import type {PlaneType} from "./ComputeCrystalPlanes";

/** Space groups that are not symmetries */
const noSymmetriesSpaceGroup = new Set(["", "P1", "P 1", "p1", "p 1",
										"x,y,z", "x, y, z"]);

/**
 * Manage equivalent hkl planes under a given symmetry
 */
export class EquivalentPlanes {

	private hasSymmetry = true;
	private mR: number[][][] = [];
	private readonly equivalents = new Map<number, Set<number>>();
	private readonly computedFrom = new Map<number, number>();

	/**
	 * Build the equivalent planes
	 *
	 * @param spaceGroup - Symmetry for which the equivalent planes should be computed
	 * @param disable - Disable computation of equivalent planes
	 */
	constructor(spaceGroup: string, disable=false) {

		if(disable || noSymmetriesSpaceGroup.has(spaceGroup)) {
			this.hasSymmetry = false;
			return;
		}

		const {matrices, status} = getSeitzRotations(spaceGroup);
		if(status === "") {

			const nm = matrices.length/9;
			this.mR = Array<number[][]>(nm);
			for(let i=0; i < nm; ++i) {

				// Allocate the 3x3 matrix
				this.mR[i] = Array<number[]>(3);
				for(let r=0; r < 3; ++r) {
					this.mR[i][r] = Array<number>(3);
				}
				for(let r=0; r < 3; ++r) {
					for(let c=0; c < 3; ++c) {
						const idx = i*9+r*3+c;
						this.mR[i][c][r] = matrices[idx]; // Transposed
					}
				}

				// The equivalent hkl planes are:
				// h'k'l' = transpose(inverse(rotation)) hkl
				this.mR[i] = inv(this.mR[i]);
			}

			// List equivalent planes
			this.computeEquivalents();
		}
		else {
			log.error("Error finding symmetry rotation matrices:", status);
			this.hasSymmetry = false;
		}
	}

	/**
	 * Add a new plane testing if it is equivalent to another
	 *
	 * @param mH - First Miller index of the new plane
	 * @param mK - Second Miller index of the new plane
	 * @param mL - Third Miller index of the new plane
	 * @returns True if the plane is equivalent to one already computed
	 */
	addCandidatePlane(mH: number, mK: number, mL: number): boolean {

		// If no symmetries all planes should be computed
		if(!this.hasSymmetry) return false;

		const hash = this.hash(mH, mK, mL);

		// Check if the candidate plane is already here
		if(this.computedFrom.has(hash)) return true;

		// Mark all equivalents as deriving from this and compute it
		for(const e of this.equivalents.get(hash)!) {
			this.computedFrom.set(e, hash);
		}
		return false;
	}

	/**
	 * Compute the hash for given h, k, l values
	 *
	 * @param h - First hkl index
	 * @param k - Second hkl index
	 * @param l - Third hkl index
	 * @returns A single number encoding the given vector
	 */
	private hash(h: number, k: number, l: number): number {
		return (h+4)+10*(k+4)+100*(l+4);
	}

	/**
	 * Compute the hash for a given (h, k, l) vector
	 *
	 * @param v - Vector of h, k, l values
	 * @returns A single number encoding the given vector
	 */
	private hashVector([h, k, l]: number[]): number {
		return this.hash(h, k, l);
	}

	/**
	 * Compute the equivalent planes
	 */
	private computeEquivalents(): void {

		for(let mH = -4; mH <= 4; mH++) {
			for(let mK = -4; mK <= 4; mK++) {
				for(let mL = -4; mL <= 4; mL++) {

					const v = [mH, mK, mL];
					const hash = this.hashVector(v);

					let all;
					if(this.equivalents.has(hash)) {
						all = this.equivalents.get(hash)!;
					}
					else {
						all = new Set<number>([hash]);
						this.equivalents.set(hash, all);
					}

					for(const m of this.mR) {
						const w = multiply(m, v);
						all.add(this.hashVector(w));
					}
				}
			}
		}
	}

	/**
	 * Fill the missing energies for the equivalent planes
	 *
	 * @param pl - Computed planes
	 */
	fillEquivalent(pl: PlaneType[]): void {

		if(!this.hasSymmetry) return;

		// Map hash to position in planes vector
		const map = new Map<number, number>();
		const n = pl.length;
		for(let i=0; i < n; ++i) map.set(this.hashVector(pl[i]), i);

		let neq = 0;
		for(let i=0; i < n; ++i) {

			if(pl[i][3] !== Number.POSITIVE_INFINITY) continue;

			const hash = this.hashVector(pl[i]);

			const hash2 = this.computedFrom.get(hash);
			if(hash2 === undefined) {
				throw Error(`Entry ${pl[i][0]}, ${pl[i][1]}, ${pl[i][2]} not found`);
			}
			const idx = map.get(hash2);
			if(idx === undefined) {
				throw Error(`Entry ${pl[i][0]}, ${pl[i][1]}, ${pl[i][2]} not found in planes`);
			}

			pl[i][3] = pl[idx][3];
			++neq;
		}

		log.info("On a total of", n, "planes there are", neq, "equivalent");
	}
}
