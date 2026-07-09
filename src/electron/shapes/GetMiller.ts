/**
 * Reconstruct the miller indices for each crystal face triangle
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-07-06
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
import {gcd} from "mathjs";

/**
 * Check for zero value
 *
 * @param v - Value to test
 * @returns True if it is almost zero
 */
const isZero = (v: number): boolean => Math.abs(v) < 1e-10;

/**
 * Return the value sign
 *
 * @param v - Value to test
 * @returns If negative returns -1 else 1
 */
const sign = (v: number): number => (v >= 0 ? 1 : -1);

/**
 * From the multipliers along the basis axis extract the miller indices
 *
 * @param ta - Plane coordinates as fraction of the a base vector.
 * @param tb - Plane coordinates as fraction of the b base vector.
 * @param tc - Plane coordinates as fraction of the c base vector.
 * @returns The hkl indices as string
 */
export const getMiller = (ta: number, tb: number, tc: number): string => {

	// Special cases
	const za = isZero(ta);
	const zb = isZero(tb);
	if(za && zb) return `(0 0 ${sign(tc)})`;
	const zc = isZero(tc);
	if(za && zc) return `(0 ${sign(tb)} 0)`;
	if(zb && zc) return `(${sign(ta)} 0 0)`;

	if(za || zb || zc) {
		let minDot = Number.POSITIVE_INFINITY;
		let minA = 0;
		let minB = 0;
		for(let a = -4; a <= 4; ++a) {
			for(let b = -4; b <= 4; ++b) {
				if(a === 0 && b === 0) continue;
				let dot = 0;
				if(za) {
					const mb = 1/tb*a;
					const mc = 1/tc*b;
					const mean = (mb+mc)/2;
					const db = mb-mean;
					const dc = mc-mean;
					dot = dc*dc+db*db;
				}
				else if(zb) {
					const ma = 1/ta*a;
					const mc = 1/tc*b;
					const mean = (ma+mc)/2;
					const da = ma-mean;
					const dc = mc-mean;
					dot = dc*dc+da*da;
				}
				else if(zc) {
					const ma = 1/ta*a;
					const mb = 1/tb*b;
					const mean = (ma+mb)/2;
					const da = ma-mean;
					const db = mb-mean;
					dot = db*db+da*da;
				}

				if(dot < minDot) {
					minDot = dot;
					minA = a;
					minB = b;
				}
			}
		}

		const m = gcd(minA, minB);
		if(m > 1) {
			minA /= m;
			minB /= m;
		}

		if(za) return `(0 ${minA} ${minB})`;
		if(zb) return `(${minA} 0 ${minB})`;
		if(zc) return `(${minA} ${minB} 0)`;
	}

	// else
	ta = 1/ta;
	tb = 1/tb;
	tc = 1/tc;

	let minDot = Number.POSITIVE_INFINITY;
	let minH = 0;
	let minK = 0;
	let minL = 0;
	for(let h = -4; h <= 4; ++h) {
		for(let k = -4; k <= 4; ++k) {
			for(let l = -4; l <= 4; ++l) {
				if(h === 0 && k === 0 && l === 0) continue;

				const ma = ta*h;
				const mb = tb*k;
				const mc = tc*l;

				const mean = (ma+mb+mc)/3;
				const da = ma-mean;
				const db = mb-mean;
				const dc = mc-mean;
				const dot = da*da+dc*dc+db*db;

				if(dot < minDot) {
					minDot = dot;
					minH = h;
					minK = k;
					minL = l;
				}
			}
		}
	}

	const m = gcd(minH, minK, minL);
	if(m > 1) {
		minH /= m;
		minK /= m;
		minL /= m;
	}

	return `(${minH} ${minK} ${minL})`;
};
