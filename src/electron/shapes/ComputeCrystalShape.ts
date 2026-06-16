/**
 * Compute the crystal shape for a given structure
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-09
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
import {multiply, transpose} from "mathjs";
import {getAtomData} from "../modules/AtomData";
import {cartesianToFractionalCoordinates} from "../modules/Helpers";
import {computePlaneEnergy} from "./ComputePlaneEnergy";
import type {Structure} from "@/types";

/**
 * Electrons count for each atom Z value (index equal Z)
 */
const electronCount = [
	0, 1, 2, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6,
	5, 3, 3, 3, 2, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 5, 3, 3, 3, 2, 2, 3,
	4, 5, 6, 7, 8, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
	3, 3, 3, 3, 3, 3, 3, 4, 5, 6, 7, 8, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
	3, 3, 3, 3, 3, 3
];

/**
 * Generates all integer [x, y, z] triplets where each component
 * is in the range (-maxCoat, maxCoat], i.e. 8*maxCoat^3 points.
 *
 * @param maxCoat - Range limit
 * @returns Array of triples
 */
const arange3d = (maxCoat: number): number[][] => {
  	const coords: number[][] = [];
	for(let x = -maxCoat; x < maxCoat; x++)
		for(let y = -maxCoat; y < maxCoat; y++)
			for(let z = -maxCoat; z < maxCoat; z++)
				coords.push([z, y, x]);

 	return coords;
};

/**
 * Compute valence
 *
 * @param inputCell - Crystal structure
 * @param fractionalCoordinates - Structure atoms fractional coordinates
 * @param radii - Atoms covalent radii
 * @returns Normalized valence effort
 */
const valenceAffortNormalize = (inputCell: Structure,
								fractionalCoordinates: number[],
								radii: number[]): number[] => {

	const maxCoat = 10;
	const decay = 0.37;

	// Generate all integer 3D coords in [-maxCoat+1, maxCoat] range,
	// sorted by Chebyshev distance
	// Shape: [8*maxCoat^3, 3]
	const rawVertices = arange3d(maxCoat).toSorted(
		(a, b) => Math.max(...a.map((v) => Math.abs(v))) - Math.max(...b.map((v) => Math.abs(v)))
	);

	const nAtoms = inputCell.atoms.length;

	// Build vertices: [8*maxCoat^3, numAtoms, 3]
	// vertices[v][a] = rawVertices[v] + atomCoords[a]
	const vertices: number[][][] = [];
	for(const rawVertex of rawVertices) {
		const v: number[][] = [];
		for(let i=0; i < nAtoms; i++) {
			const i3 = i*3;
			const fx = rawVertex[0] + fractionalCoordinates[i3];
			const fy = rawVertex[1] + fractionalCoordinates[i3 + 1];
			const fz = rawVertex[2] + fractionalCoordinates[i3 + 2];
			v.push([fx, fy, fz]);
		}
		vertices.push(v);
	}
	const norms: number[] = [];

	const {basis} = inputCell.crystal;

	// Iterate over atoms: source = vertices[0][atomIdx], rad = radii[atomIdx]
	for(let atomIdx = 0; atomIdx < nAtoms; atomIdx++) {

		const rad = radii[atomIdx];
		const source = vertices[0][atomIdx]; // [3]

		// For each vertex v and atom a, compute: (source - vertices[v][a]) @ cell
		// r_ss_norm[v][a] = L2 norm of that result
		let sumExp = 0;
		for(let v = 0; v < rawVertices.length; v++) {
			for(let a = 0; a < nAtoms; a++) {
				const diff = [
					source[0] - vertices[v][a][0],
					source[1] - vertices[v][a][1],
					source[2] - vertices[v][a][2],
				];

				// Multiply diff (1x3) by cell matrix (3x3) → transformed (1x3)
				// const transformed = matVecMul(inputCell.cell, diff);

				const transformed = [
					diff[0]*basis[0] + diff[1]*basis[3] + diff[2]*basis[6],
					diff[0]*basis[1] + diff[1]*basis[4] + diff[2]*basis[7],
					diff[0]*basis[2] + diff[1]*basis[5] + diff[2]*basis[8],
				];

				// L2 norm
				const l2norm = Math.sqrt(transformed.reduce((sum, x) => sum + x * x, 0));

				sumExp += Math.exp(-(l2norm - rad - radii[a]) / decay);
			}
		}

		// Subtract self-interaction term: exp(2*rad / decay)
		norms.push(sumExp - Math.exp((2 * rad) / decay));
	}

	return norms;
};

// Tile norms, radii, vElNumber sz times and reshape to [sz * cell.length, 1]
const tileAndReshape = (array: number[], sz: number): number[][] => {
	const tiled: number[] = [];
	for(let i = 0; i < sz; i++) tiled.push(...array);
	return tiled.map((v) => [v]);
};

const connectedComponents = (matrix: number[][]): {count: number; labels: number[]} => {

	const n = matrix.length;
	const labels = Array<number>(n).fill(-1);
	let count = 0;

	for(let i = 0; i < n; i++) {
		if(labels[i] !== -1) continue;
		// BFS
		const queue = [i];
		labels[i] = count;
		while(queue.length > 0) {
			const node = queue.shift()!;
			for(let j = 0; j < n; j++) {
				if(matrix[node][j] !== 0 && labels[j] === -1) {
					labels[j] = count;
					queue.push(j);
				}
			}
		}
		count++;
	}

  	return {count, labels};
};

const determineEnergiesNeeded = (cell: number[][],
								 trans: number[][],
								 norms: number[],
								 radii: number[],
								 electrons: number[],
								 goodBonds: number): number => {

	const sz = 27;

	const closestOffsets: number[][] = [
		[0, 0, 0],   [-1, 0, 0],  [-1, 0, -1], [-1, -1, -1], [-1, -1, 0],
		[0, -1, 0],  [0, -1, -1], [0, 0, -1],  [-1, -1, 1],  [-1, 0, 1],
		[-1, 1, 1],  [-1, 1, 0],  [-1, 1, -1], [0, -1, 1],   [0, 0, 1],
		[0, 1, 1],   [0, 1, 0],   [0, 1, -1],  [1, 0, 0],    [1, 0, -1],
		[1, -1, -1], [1, -1, 0],  [1, -1, 1],  [1, 0, 1],    [1, 1, 1],
		[1, 1, 0],   [1, 1, -1]
	];

	// Build vertices: for each offset, add it to every row of cell
	const vertices: number[][] = [];
	for(const offset of closestOffsets) {
		for(const row of cell) {
			vertices.push(row.map((v, i) => v + offset[i]));
		}
	}

	// Compute dists = cdist(vertices @ trans, vertices @ trans)
	const projected = vertices.map((row) => (multiply([row], trans))[0]);

	const dists: number[][] = projected.map((a) =>
		projected.map((b) =>
			Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0))
		)
	);

	const normsSzCell = tileAndReshape(norms, sz);
	const radiiSzCell = tileAndReshape(radii, sz);
	const vElectronCountSzCell = tileAndReshape(electrons, sz);

	// val_aff = exp(-(dists - radii - radii.T) / 0.37) / sqrt(norms) / sqrt(norms.T)
	const n = normsSzCell.length;

	const valueAff: number[][] = Array.from({length: n}, (_, i) =>
		Array.from({length: n}, (_x, j) => {
			const rSum = radiiSzCell[i][0] + radiiSzCell[j][0];
			const nProduct = Math.sqrt(normsSzCell[i][0]) * Math.sqrt(normsSzCell[j][0]);
			return Math.exp(-(dists[i][j] - rSum) / 0.37) / nProduct;
		})
	);

	const energies: number[][] = Array.from({length: n}, (_, i) =>
		Array.from({length: n}, (_x, j) => {
			const vProduct = vElectronCountSzCell[i][0] * vElectronCountSzCell[j][0];
			const rDiff = radiiSzCell[i][0] - radiiSzCell[j][0];
			const denom = Math.abs(dists[i][j] ** 2 - rDiff ** 2 / 4);
			return 0.481 * Math.sqrt(vProduct / denom) * valueAff[i][j];
		})
	);

	// Flatten, deduplicate, and sort descending (mirrors np.unique(energies)[::-1])
	const uniqueEnergies: number[] = [...new Set(energies.flat())].toSorted((a, b) => b - a);

	const m = energies.length;

	for(const cutoff of uniqueEnergies) {
		const graphMatrix: number[][] = Array.from({length: m}, (_, i) =>
			Array.from({length: m}, (_x, j) => {
				const withinBand = cutoff * 0.9 < energies[i][j] && energies[i][j] < cutoff * 1.1;
				const dominated  = energies[i][j] < Infinity && valueAff[i][j] > goodBonds;
				return dominated || withinBand ? 1 : 0;
			})
		);

		const {labels} = connectedComponents(graphMatrix);

		const cellRows = cell.length;
		const allZero = labels.slice(0, cellRows).every((l) => l === 0);
		if(allZero) return cutoff;
	}

	throw Error("Can not make connected");
};

const checkSign = (h: number, k: number, l: number): boolean => {

    if(h > 0 && k > 0 && l > 0) return true;
    if(h < 0 && k > 0 && l > 0) return true;
    if(h > 0 && k < 0 && l > 0) return true;
    if(h > 0 && k > 0 && l < 0) return true;
    if(h === 0 && k > 0 && l > 0) return true;
    if(h === 0 && k < 0 && l > 0) return true;
    if(h > 0 && k === 0 && l > 0) return true;
    if(h > 0 && k === 0 && l < 0) return true;
    if(h > 0 && k > 0 && l === 0) return true;
    if(h < 0 && k > 0 && l === 0) return true;
    if(h > 0 && k === 0 && l === 0) return true;
    if(h === 0 && k > 0 && l === 0) return true;
    if(h === 0 && k === 0 && l > 0) return true;
    return false;
};

const isSimple = (h: number, k: number, l: number): boolean => {

	const indxs = [];
    if(h !== 0) indxs.push(Math.abs(h));
	if(k !== 0) indxs.push(Math.abs(k));
	if(l !== 0) indxs.push(Math.abs(l));
	const min = Math.min(...indxs);
	for(let denom=2; denom <= min; ++denom) {
		if(indxs.every((v) => v%denom === 0)) return false;
	}
    return true;
};

export type PlaneType = [h: number, k: number, l: number, energy: number];

/**
 * Find Miller planes and their energies that characterize the structure
 *
 * @param structure - Structure for which the crystal shape should be computed
 * @returns Array of valid hkl planes
 */
export const computeCrystalShape = (structure: Structure): PlaneType[] => {

	const {atoms, crystal} = structure;
	const {basis} = crystal;

	const fractionalCoordinates = cartesianToFractionalCoordinates(structure);

	const electrons = [];
	const radii = [];
	for(const {atomZ} of atoms) {
		const ne = atomZ > electronCount.length ? 3 : electronCount[atomZ];
		electrons.push(ne);
		const r = getAtomData(atomZ).rCov;
		radii.push(r);
	}

	const norms = valenceAffortNormalize(structure, fractionalCoordinates, radii);

	const cell: number[][] = [];
	for(let i=0; i < atoms.length; i++) {
		const i3 = i*3;
		cell.push([
			fractionalCoordinates[i3],
			fractionalCoordinates[i3+1],
			fractionalCoordinates[i3+2]
		]);
	}

	const trans: number[][] = [];
	for(let i=0; i < 3; i++) {
		const i3 = i*3;
		trans.push([
			basis[i3],
			basis[i3+1],
			basis[i3+2]
		]);
	}

	const goodBonds = 0.05;

	const extraEnergy = determineEnergiesNeeded(cell, trans, norms, radii, electrons, goodBonds);

  	const inputCellT = transpose(trans);

	// There are max 9*9*9 planes (from -4 to 4 there are 9 plane indices)
	const planes = Array<PlaneType>(729);
	let planeIndex = -1;

	for(let mH = -4; mH <= 4; mH++) {
		for(let mK = -4; mK <= 4; mK++) {
			for(let mL = -4; mL <= 4; mL++) {

				if(!checkSign(mH, mK, mL) || !isSimple(mH, mK, mL)) continue;

				++planeIndex;
				planes[planeIndex] = [mH, mK, mL, Number.POSITIVE_INFINITY];

				// TBD This will be parallelized
				const [index, minEnergy] = computePlaneEnergy(mH, mK, mL, planeIndex,
															  cell,
															  trans,
															  norms,
															  radii,
															  electrons,
															  goodBonds,
															  extraEnergy,
															  inputCellT);
				planes[index][3] = minEnergy;
			}
		}
	}

	// Limit planes to the ones really computed
	planes.length = planeIndex + 1;

	// Sort planes by increasing energy
	planes.sort((a, b) => a[3] - b[3]);

	return planes;
};
