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
import {multiply} from "mathjs";
import {getSeitzRotations} from "../modules/NativeFunctions";
import type {PlaneType} from "./ComputeCrystalPlanes";

/** Space groups that are not symmetries */
const noSymmetriesSpaceGroup = new Set(["", "P1", "P 1", "p1", "p 1",
										"x,y,z", "x, y, z"]);

export class EquivalentPlanes {

	private hasSymmetry = true;
	private mR: number[][][] = [];
	private readonly planes = new Map<number, number>();

	constructor(spaceGroup: string) {

		if(noSymmetriesSpaceGroup.has(spaceGroup)) {
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
				const m = this.mR[i];
				console.log("----");
				console.log(`[${m[0][0]}, ${m[0][1]}, ${m[0][2]}`);
				console.log(` ${m[1][0]}, ${m[1][1]}, ${m[1][2]}`);
				console.log(` ${m[2][0]}, ${m[2][1]}, ${m[2][2]}]`);
				// const t = transpose(this.mR[i]);
				// // this.mR[i] = transpose(this.mR[i]);
				// // this.mR[i] = transpose(inv(this.mR[i]));
				// console.log(`[${t[0][0]}, ${t[0][1]}, ${t[0][2]}`);
				// console.log(` ${t[1][0]}, ${t[1][1]}, ${t[1][2]}`);
				// console.log(` ${t[1][0]}, ${t[1][1]}, ${t[1][2]}]`);
				// this.mR[i] = t;
			}
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

		const v = [mH, mK, mL];
		const hash1 = this.hashVector(v);

		// Check if the new plane is already here
		// if(this.planes.has(hash1))
		for(const m of this.mR) {
			const w = multiply(m, v);

			const hash2 = this.hashVector(w);
			if(this.planes.has(hash2)) {
				if(this.planes.get(hash2)! !== -1) continue;
				this.planes.set(hash1, hash2);
				return true;
			}
		}

		this.planes.set(hash1, -1);
		return false;
	}

	private hashVector(v: number[]): number {
		return (v[0]+4)+10*(v[1]+4)+100*(v[2]+4);
	}

	private deHash(hash: number): [number, number, number] {
		const hh = hash%10;
		const h = hh-4;
		const kk = ((hash-hh)/10)%10;
		const k = kk-4;
		const l = ((hash-hh-kk*10)/100)%10-4;
		return [h, k, l];
	}

	test(): void {
		for(let mH = -4; mH <= 4; mH++) {
			for(let mK = -4; mK <= 4; mK++) {
				for(let mL = -4; mL <= 4; mL++) {
					this.addCandidatePlane(mH, mK, mL);
					// const h = this.hash(mH, mK, mL);
					// const dh = this.deHash(h);
					// console.log(mH, mK, mL, "->", dh);
					// const mark = this.addCandidatePlane(mH, mK, mL) ? "*" : " ";
					// console.log(mark, mH.toString().padStart(2), mK.toString().padStart(2), mL.toString().padStart(2));
				}
			}
		}

		for(const e of this.planes) {
			const o = this.deHash(e[0]);
			if(e[1] === -1) {
				console.log(o[0].toString().padStart(2), o[1].toString().padStart(2), o[2].toString().padStart(2));
			}
			else {
				const w = this.deHash(e[1]);
				console.log(o[0].toString().padStart(2), o[1].toString().padStart(2), o[2].toString().padStart(2), "->", w[0].toString().padStart(2), w[1].toString().padStart(2), w[2].toString().padStart(2));
			}
		}
	}

	dump(): void {

		console.log("=== Rotation matrices ===");
		const nm = this.mR.length;
		for(let i=0; i < nm; ++i) {
			let l = "[";
			for(let r=0; r < 3; ++r) {
				let s = r===0 ? "" : " ";
				for(let c=0; c < 3; ++c) {

					s += this.mR[i][r][c].toFixed(0).padStart(c>0 ? 3 : 2);
				}
				l += s + (r===2 ? "]" : "\n");
			}
			console.log(l);
		}
	}

	fillEquivalent(pl: PlaneType[]): void {

		if(!this.hasSymmetry) return;

		const map = new Map<number, number>();
		const n = pl.length;
		for(let i=0; i < n; ++i) map.set(this.hashVector(pl[i]), i);

		let neq = 0;
		for(let i=0; i < n; ++i) {
			if(pl[i][3] !== Number.POSITIVE_INFINITY) continue;
			const equivalent = this.planes.get(this.hashVector(pl[i]));
			if(equivalent === undefined) throw Error("Equivalent plane not found");
			const energy = map.get(equivalent);
			if(energy === undefined) throw Error("Equivalent plane energy not found");
			pl[i][3] = energy;
			++neq;
		}

		console.log("Total planes:", n, "of which equivalent:", neq);
	}
}
