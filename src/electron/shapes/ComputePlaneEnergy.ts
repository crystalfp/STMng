/**
 * Compute plane energy
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-16
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
import {inv, cross} from "mathjs";
import {cdist, dotRows, range, cross3, norm, matVec} from "./Helpers";

const cs = (mag: number, sign: number): number => Math.sign(sign) * Math.abs(mag);
const sorted2 = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);

const reduced = (m: number[]): number[] => {

	const min = Math.min(...m.map((v) => Math.abs(v)));
	for(let n=min; n > 1; --n) {
		if(m.every((v) => v%n === 0)) return m.map((v) => v/n);
	}
    return m;
};

function adjust(cell: number[][]): number[][] {
  return cell.map((vertex) =>
    vertex.map((component) => (component < 0 ? 1.0 + component : component))
  );
}

const determineTransform = (
							mH: number,
							mK: number,
							mL: number
						): [number[][], number[], number[], number[], number[][]] => {
	let shift: number[];
	let r1: number[];
	let r2: number[];
	let scope: number[][];

	if(mH === 0 && mK !== 0 && mL === 0) {
		shift = [0, 0, 0];
		r2    = [0, 0, 1];
		r1    = [1, 0, 0];
		scope = [[0, 1], [0, 1], [0, 1]];
	}
	else if(mH !== 0 && mK === 0 && mL === 0) {
		shift = [0, 0, 0];
		r2    = [0, 1, 0];
		r1    = [0, 0, 1];
		scope = [[0, 1], [0, 1], [0, 1]];
	}
	else if(mH === 0 && mK === 0 && mL !== 0) {
		shift = [0, 0, 0];
		r2    = [1, 0, 0];
		r1    = [0, 1, 0];
		scope = [[0, 1], [0, 1], [0, 1]];
	}
	else if(mH !== 0 && mK !== 0 && mL === 0) {
		shift = [-mK, 0, 0];
		r1    = [-mK, mH, 0];
		r2    = [0, 0, 1];
		scope = [sorted2(0, mK), sorted2(0, mH), [0, 1]];
	}
	else if(mH === 0 && mK !== 0 && mL !== 0) {
		shift = [0, 0, -mK];
		r2    = [0, mL, -mK];
		r1    = [1, 0, 0];
		scope = [[0, 1], sorted2(0, mL), sorted2(0, mK)];
	}
	else if(mH !== 0 && mK === 0 && mL !== 0) {
		shift = [0, 0, -mH];
		r2    = [0, 1, 0];
		r1    = [mL, 0, -mH];
		scope = [sorted2(0, mL), [0, 1], sorted2(0, mH)];
	}
	else if(mH !== 0 && mK !== 0 && mL !== 0) {
		const mRed = reduced([Math.abs(mK*mL), Math.abs(mL*mH), Math.abs(mH*mK)]);
		shift = [0, 0, -cs(2 * mRed[2], mL)];
		r1    = [cs(mRed[0], mH), 0, -cs(mRed[2], mL)];
		r2    = [0, cs(mRed[1], mK), -cs(mRed[2], mL)];
		scope = [
			sorted2(0, cs(mRed[0], mH)),
			sorted2(0, cs(mRed[1], mK)),
			sorted2(0, 2 * cs(mRed[2], mL)),
		];
	}
	else {
		throw new Error("Invalid Indexes");
	}

	// Build matrix M = [r1, r2, r1×r2]^T  (rows are r1, r2, normal)
	// then invert to get trans
	const normal = cross(r1, r2) as number[];
	const M = [r1, r2, normal].map((row) => row.map(Number)); // 3×3, rows = vectors

	// Transpose M so columns are r1, r2, normal  (matches numpy layout)
	const MT: number[][] = Array.from({length: 3}, (_, i) =>
		Array.from({length: 3}, (_x, j) => M[j][i])
	);

	const trans = inv(MT);

	return [trans, shift, r1, r2, scope];
};

const createBondArray = (
							cell: number[][],
							trans: number[][],
							norms: number[],
							radii: number[],
							vElectronNumber: number[],
							goodBonds: number,
							extraEnergy: number
						): [number[], number[][][]] => {

	const sz = 27;
	const closestOffsets: number[][] = [
		[0, 0, 0], [-1, 0, 0], [-1, 0, -1], [-1, -1, -1], [-1, -1, 0],
		[0, -1, 0], [0, -1, -1], [0, 0, -1], [-1, -1, 1], [-1, 0, 1],
		[-1, 1, 1], [-1, 1, 0], [-1, 1, -1], [0, -1, 1], [0, 0, 1],
		[0, 1, 1], [0, 1, 0], [0, 1, -1], [1, 0, 0], [1, 0, -1],
		[1, -1, -1], [1, -1, 0], [1, -1, 1], [1, 0, 1], [1, 1, 1],
		[1, 1, 0], [1, 1, -1]
	];

	const vertices: number[][] = [];
	for(const offset of closestOffsets)
		for(const row of cell)
			vertices.push(row.map((v, i) => v + offset[i]));

	const projected = dotRows(vertices, trans);
	const dists = cdist(projected, projected);

	const N = sz * cell.length;
	const tileCol = (array: number[]): number[] => {
		const out: number[] = [];
		for(let i = 0; i < sz; i++) out.push(...array);
		return out;
	};

	const normsTiled     = tileCol(norms);
	const radiiTiled     = tileCol(radii);
	const vElectronTiled = tileCol(vElectronNumber);

	// val_aff[i][j]
	const valueAff: number[][] = Array.from({length: N}, (_, i) =>
		Array.from({length: N}, (_2, j) => {
			const rSum  = radiiTiled[i] + radiiTiled[j];
			const nProduct = Math.sqrt(normsTiled[i]) * Math.sqrt(normsTiled[j]);
			return Math.exp(-(dists[i][j] - rSum) / 0.37) / nProduct;
		})
	);

	// energies[i][j]
	const energies: number[][] = Array.from({length: N}, (_, i) =>
		Array.from({length: N}, (_2, j) => {
			const vProduct = vElectronTiled[i] * vElectronTiled[j];
			const rDiff = radiiTiled[i] - radiiTiled[j];
			const denom = Math.abs(dists[i][j]**2 - rDiff**2 / 4);
			return 0.481 * Math.sqrt(vProduct / denom) * valueAff[i][j];
		})
	);

	// graph_matrix[i][j]
	const graphMatrix: number[][] = Array.from({length: N}, (_, i) =>
		Array.from({length: N}, (_2, j) => {
			const dominated = energies[i][j] < Infinity && valueAff[i][j] > goodBonds;
			const inBand    = extraEnergy*0.9 < energies[i][j] && energies[i][j] < extraEnergy*1.1;
			return dominated || inBand ? 1 : 0;
		})
	);

	// bonds[i][j] = [[vert_i], [vert_j]]  shape: [N][N][2][3]
	const bonds: number[][][][] = Array.from({length: N}, (_, i) =>
		Array.from({length: N}, (_2, j) => [vertices[j], vertices[i]])
	);

	// Upper-triangular indices of graphMatrix[0:cell.length, 0:8*cell.length]
	const rows = cell.length;
	const cols = 8 * cell.length;
	const indI: number[] = [], indJ: number[] = [];
	for(let i = 0; i < rows; i++)
		for(let j = i; j < cols; j++)
			if(graphMatrix[i][j] !== 0) {
				indI.push(i);
				indJ.push(j);
			}

	const selEnergies = indI.map((i, k) => energies[i][indJ[k]]);
	const selBonds    = indI.map((i, k) => bonds[i][indJ[k]]);

	return [selEnergies, selBonds];
};

const MIS_X = 0.00000001;
const MIS_Y = 0.00000001;
const MIS_Z = 0.001;

// > Entry point
/**
 * Compute plane for a given set of hkl indices
 *
 * @param mH - H index of the plane
 * @param mK - K index of the plane
 * @param mL - L index of the plane
 * @param cell - Atom fractional coordinates
 * @param trans - Unit cell basis vectors
 * @param norms - For each atom its valence distance
 * @param radii - Atoms covalent radii
 * @param electrons - Number of electrons for each atom
 * @param goodBonds - ?
 * @param extraEnergy - ?
 * @param inputCellT - Transposed cell basis vectors
 * @returns Minimal energy for the plane
 */
export const computePlaneEnergy = (mH: number, mK: number, mL: number,
								   cell: number[][],
								   trans: number[][], norms: number[], radii: number[],
								   electrons: number[], goodBonds: number,
								   extraEnergy: number,
								   inputCellT: number[][]): number => {

	const [trans2, shift, r1, r2, scope] = determineTransform(mH, mK, mL);

	const largeScope: [number[], number[], number[]] = [
		range(scope[0][0] - 1, scope[0][1] + 1),
		range(scope[1][0] - 1, scope[1][1] + 1),
		range(scope[2][0] - 1, scope[2][1] + 1),
	];

	const largeScopeSize = [
		scope[0][1] - scope[0][0] + 2,
		scope[1][1] - scope[1][0] + 2,
		scope[2][1] - scope[2][0] + 2,
	];
	const largeScopeSizeProduct = largeScopeSize[0] *
									largeScopeSize[1] *
									largeScopeSize[2];

	// Flat list of all scope offset triples [largeScopeSizeProd, 3]
	const scopeOffsets: number[][] = [];
	for(const x of largeScope[0])
		for(const y of largeScope[1])
			for(const z of largeScope[2])
				scopeOffsets.push([x, y, z]);

	// measure = ||inputCell.T @ r1  ×  inputCell.T @ r2||
	const measure = norm(cross3(matVec(inputCellT, r1), matVec(inputCellT, r2)));

	const energiesOut: number[] = [];

	for(const vertex of cell) {

		const shiftedCell = adjust(cell.map((v) => v.map((c, i) => c - vertex[i])));
		const [energiesArray, bondArray] = createBondArray(
			shiftedCell, trans, norms, radii, electrons, goodBonds, extraEnergy
		);

		const source: number[][] = [];
		const sink: number[][] = [];
		const scz: number[] = [];
		const skz: number[] = [];

		for(const sol of scopeOffsets) {

			for(const bol of bondArray) {

				let idx = 0;
				for(const e of bol) {
					const translated = [
						e[0]+sol[0]+shift[0],
						e[1]+sol[1]+shift[1],
						e[2]+sol[2]+shift[2]
					];
					const projected = matVec(trans2, translated);
					projected[2] += MIS_Z;
					if(idx) {
						sink.push(projected);
						skz.push(projected[2]);
					}
					else {
						source.push(projected);
						scz.push(projected[2]);
					}
					++idx;
				}
			}
		}

		const koeffSize = scz.length/largeScopeSizeProduct;
		const koeff = Array(koeffSize).fill(0);

		for(let i=0; i < scz.length; ++i) {

			if(skz[i] * scz[i] >= 0 || skz[i] === scz[i]) continue;

			const dz = scz[i] - skz[i];
			const rr0 = (scz[i] * sink[i][0] - skz[i] * source[i][0]) / dz;
			const rr1 = (scz[i] * sink[i][1] - skz[i] * source[i][1]) / dz;

			if(MIS_X <= rr0 && rr0 <= 1 + MIS_X &&
				MIS_Y <= rr1 && rr1 <= 1 + MIS_Y) {

				++koeff[i%koeffSize];
			}
		}

		let e = 0;
		for(let i=0; i < koeffSize; ++i) e += koeff[i]*energiesArray[i];
		energiesOut.push(e/measure);
	}

	let minEnergy = Number.POSITIVE_INFINITY;
	for(const e of energiesOut) {
		if(e < minEnergy) minEnergy = e;
	}
	return minEnergy;
};
