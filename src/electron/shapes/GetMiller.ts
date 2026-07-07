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
 * From the multipliers along the basis axis extract the miller indices
 *
 * @param ta - Plane coordinates as fraction of the a base vector.
 * @param tb - Plane coordinates as fraction of the b base vector.
 * @param tc - Plane coordinates as fraction of the c base vector.
 * @returns The hkl indices as string
 */
export const getMiller = (ta: number, tb: number, tc: number): string => {

	let minDot = Number.POSITIVE_INFINITY;
	let minH = 0;
	let minK = 0;
	let minL = 0;
	for(let h= -4; h <= 4; ++h) {
		for(let k= -4; k <= 4; ++k) {
			for(let l= -4; l <= 4; ++l) {
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
