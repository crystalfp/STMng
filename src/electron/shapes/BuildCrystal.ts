/**
 * Build the crystal shape from the list of planes
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
/* eslint-disable unicorn/prevent-abbreviations, unicorn/prefer-includes-over-repeated-comparisons */
import type {BasisType} from "@/types";
import type {PlaneType} from "./ComputeCrystalShape";

const DEDUP_ATOL = 1e-6;
const RTOL = 1e-5;
const ATOL = 1e-8;

// --- helpers ---

const argsortByAbsRow = (row: number[]): number[] => {
  return row
            .map((v, i) => [Math.abs(v), i] as [number, number])
            .toSorted((a, b) => a[0] - b[0])
            .map(([, i]) => i);
};

const cross3 = (a: number[], b: number[]): number[] => {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0],
    ];
};

const norm = (v: number[]): number => {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
};

const det3x3 = (m: number[][]): number => {
    return (
        m[0][0] * (m[1][1]*m[2][2] - m[1][2]*m[2][1]) -
        m[0][1] * (m[1][0]*m[2][2] - m[1][2]*m[2][0]) +
        m[0][2] * (m[1][0]*m[2][1] - m[1][1]*m[2][0])
    );
};

const solve3x3 = (m: number[][], b: number[]): number[] => {

    const det = det3x3(m);
    // Cramer's rule
    const solve1D = (col: number): number => {
        const tmp = m.map((row, i) =>
            row.map((v, j) => (j === col ? b[i] : v))
        );
        return det3x3(tmp) / det;
    };
    return [solve1D(0), solve1D(1), solve1D(2)];
};

/** np.isclose equivalent: |a - b| \<= atol + rtol * |b| */
const isClose = (a: number, b: number, atol = ATOL, rtol = RTOL): boolean => {
    return Math.abs(a - b) <= atol + rtol * Math.abs(b);
};

/** Dot product of two vectors */
const dot = (a: number[], b: number[]): number => {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
};

/**
 * Euclidean distance between two 3-vectors.
 * Inlined to avoid building full distance matrices.
 */
const euclidean = (a: number[], b: number[]): number => {
    return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
};

// --- get_normals ---
// plane_miller: [N, 3]   cell: [3, 3]
const getNormals = (planeMiller: number[][], cell: number[][]): number[][] => {

    return planeMiller.map((miller) => {
        // argsort by absolute value  (equivalent to np.argsort(np.abs(miller)))
        const order = argsortByAbsRow(miller);

        // miller_sorted: reorder components of this row
        const ms = order.map((i) => miller[i]);          // [3]

        // cell_sorted: reorder rows of cell
        const cs = order.map((i) => cell[i]);            // [3][3]

        // norms = cross(ms[2]*cs[0] - ms[0]*cs[2],
        //               ms[2]*cs[1] - ms[1]*cs[2])
        const vecA = cs[0].map((v, i) => ms[2]*v - ms[0]*cs[2][i]);
        const vecB = cs[1].map((v, i) => ms[2]*v - ms[1]*cs[2][i]);
        const n    = cross3(vecA, vecB);
        const mag  = norm(n);
        return n.map((v) => v / mag);
    });
};

// --- get_normals_rvalues ---
const getNormalsRvalues = (
							planeMiller: number[][],
							planeEnergy: number[],
							cell: number[][]
						): [number[][], number[]] => {

	const normals  = getNormals(planeMiller, cell);
	const negNormals = normals.map((n) => n.map((v) => -v));

	// vstack(normals, -normals)  →  [2N, 3]
	const allNormals = [...normals, ...negNormals];

	// hstack(rvalues, rvalues)   →  [2N]
	const allRvalues = [...planeEnergy, ...planeEnergy];

	return [allNormals, allRvalues];
};

// --- conc_arng_notrv ---
// Returns all index triples (i, j, k) with i < j < k, for 0 <= i,j,k < size.
const concArangNotrv = (size: number): [number[], number[], number[]] => {

    const i0: number[] = [], i1: number[] = [], i2: number[] = [];
    for(let a = 0; a < size; a++)
        for(let b = a + 1; b < size; b++)
            for(let c = b + 1; c < size; c++) {
                i0.push(a);
                i1.push(b);
                i2.push(c);
            }
    return [i0, i1, i2];
};

// --- conc_RV ---
// For each triple (a,b,c) with a<b<c, returns [rvalue[c], rvalue[b], rvalue[a]]
// matching numpy's concat of the three tiled arrays indexed by [i0,i1,i2].
const concRV = (planeRvalue: number[]): number[][] => {
    const [i0, i1, i2] = concArangNotrv(planeRvalue.length);
    return i0.map((a, t) => [
        planeRvalue[i2[t]],   // RV1: varies on axis-2 (innermost)
        planeRvalue[i1[t]],   // RV2: varies on axis-1
        planeRvalue[a],       // RV3: varies on axis-0 (outermost)
    ]);
};

// --- conc_N ---
// For each triple (a,b,c) with a<b<c, returns [normal[c], normal[b], normal[a]]
// as a [3][3] matrix (three row-normals stacked).
const concN = (planeNormals: number[][]): number[][][] => {
    const [i0, i1, i2] = concArangNotrv(planeNormals.length);
    return i0.map((a, t) => [
        planeNormals[i2[t]],  // N1
        planeNormals[i1[t]],  // N2
        planeNormals[a],      // N3
    ]);
};

// --- plane_intersections ---
const planeIntersections = (
                                planeNormals: number[][],
                                planeRvalue: number[]
                           ): number[][] => {

    // Build all [3,3] normal matrices for strictly-ordered triples
    const allN  = concN(planeNormals);
    const allRV = concRV(planeRvalue);

    // Keep only triples whose normal matrix has non-zero determinant
    const filteredN:  number[][][] = [];
    const filteredRV: number[][]  = [];
    for(let t = 0; t < allN.length; t++) {
        if(Math.abs(det3x3(allN[t])) > 1e-14) {
            filteredN.push(allN[t]);
            filteredRV.push(allRV[t]);
        }
    }

    // Solve in batches of 100,000 (mirrors Python's chunked np.linalg.solve)
    const results: number[][] = [];
    const batchSize = 100_000;
    for(let start = 0; start < filteredN.length; start += batchSize) {
        const end = Math.min(start + batchSize, filteredN.length);
        for(let t = start; t < end; t++) {
            results.push(solve3x3(filteredN[t], filteredRV[t]));
        }
    }
    return results;
};

const ifInPolyhedra = (
                        points: number[][],
                        normals: number[][],
                        rvalues: number[],
                    ): boolean[] => {
    return points.map((p) =>
        normals.every((n, j) => {
            const d = dot(p, n);
            return d < rvalues[j] || isClose(d, rvalues[j]);
        })
    );
};

const markDuplicatesInChunk = (chunkStart: number,
                               chunkEnd: number,
                               polyhedraRNu: number[][],
                               keep: boolean[]): void => {

    for(let i = chunkStart; i < chunkEnd; i++) {
        if(!keep[i]) continue;
        // compare against all rows j < i (lower-triangular,
        //      column index offset = -1 + chunkStart in Python)
        for(let j = 0; j < i; j++) {
            if(euclidean(polyhedraRNu[i], polyhedraRNu[j]) <= DEDUP_ATOL) {
                keep[i] = false;
                break;
            }
        }
    }
};

/**
 * From the planes compute the crystal shape
 *
 * @param basis - Structure basis
 * @param planes - Planes computed in the previous step
 * @param maxPlanes - Maximum number of planes to use (zero means all)
 */
export const buildCrystalShape = (basis: BasisType, planes: PlaneType[], maxPlanes=0): void => {

	// Normalize the cell basis
	const cell: number[][] = [];
	for(let i=0; i < 3; i++) {
		const i3 = i*3;
		cell.push([
			basis[i3],
			basis[i3+1],
			basis[i3+2]
		]);
	}

	// Planes used in the subsequent steps
	const planeMiller: number[][] = [];
	const planeEnergy: number[] = [];

	// Limit the number of planes
	const nPlanes = planes.length;
	if(maxPlanes > 0 && nPlanes > maxPlanes+3) {

		let e100;
		let e010;
		let e001;
		for(let i=0; i < nPlanes; ++i) {
			const p = planes[i];
			if(p[0] === 1 && p[1] === 0 && p[2] === 0)      e100 = p[3];
			else if(p[0] === 0 && p[1] === 1 && p[2] === 0) e010 = p[3];
			else if(p[0] === 0 && p[1] === 0 && p[2] === 1) e001 = p[3];
		}

		if(e100 === undefined || e010 === undefined || e001 === undefined) {
			throw Error("Missing planes 100 or 010 or 001");
		}

		for(let i=0; i < maxPlanes; ++i) {
			planeMiller.push(planes[i].slice(0, 3));
			planeEnergy.push(planes[i][3]);
		}
		planeMiller.push([1, 0, 0], [0, 1, 0], [0, 0, 1]);
		planeEnergy.push(e100, e010, e001);
	}
	else {
		for(let i=0; i < nPlanes; ++i) {
			planeMiller.push(planes[i].slice(0, 3));
			planeEnergy.push(planes[i][3]);
		}
	}

	// Compute normals
	console.log("Compute normals");
	const [planeNormals, planeRvalue] = getNormalsRvalues(planeMiller, planeEnergy, cell);

	console.log("Calculating intersections");
	const planeR = planeIntersections(planeNormals, planeRvalue);

    console.log("Searching interior polyhedra vertices");

    // The Python code chunks in blocks of 100 000; with 71 rows here one pass suffices,
    // but the chunked loop is preserved for correctness with larger datasets.
    const CHUNK = 100_000;
    const inPolyhedra: boolean[] = [];
    const nRows = planeR.length;
    const iMax = Math.floor(nRows / CHUNK);

    for(let i = 0; i < iMax; i++) {
        inPolyhedra.push(
            ...ifInPolyhedra(planeR.slice(i * CHUNK, (i + 1) * CHUNK), planeNormals, planeRvalue),
        );
    }
    inPolyhedra.push(
        ...ifInPolyhedra(planeR.slice(iMax * CHUNK), planeNormals, planeRvalue),
    );

    const polyhedraRNu: number[][] = planeR.filter((_, i) => inPolyhedra[i]);

    // ─── Step 2: deduplicate (keep unique rows up to atol = 1e-6) ─────────────────
    // Python uses a lower-triangular trick with cdist:
    //   for row i, keep it only if no earlier row j < i is within atol=1e-6 of it.

    const iStep = Math.max(1, Math.floor(100_000_000 / polyhedraRNu.length));
    const iMax2 = Math.floor(polyhedraRNu.length / iStep);

    // keep[i] = true  ↔  no earlier row is a duplicate of row i
    const keep: boolean[] = Array<boolean>(polyhedraRNu.length).fill(true);

    for(let i = 0; i < iMax2; i++) {
        markDuplicatesInChunk(i * iStep, (i + 1) * iStep, polyhedraRNu, keep);
    }
    markDuplicatesInChunk(iMax2 * iStep, polyhedraRNu.length, polyhedraRNu, keep);

    const polyhedraR: number[][] = polyhedraRNu.filter((_, i) => keep[i]);

    // ─── Output ───────────────────────────────────────────────────────────────────

    console.log(polyhedraR);
};
