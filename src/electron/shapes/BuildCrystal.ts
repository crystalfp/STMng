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
import Delaunator from "delaunator";
import type {BasisType} from "@/types";
import type {PlaneType} from "./ComputeCrystalPlanes";
import {argsortByAbsRow, cross3, det3x3, dot, dot3, euclidean,
        inv3, isClose, mulVecMat3, norm, solve3x3, sub3} from "./Helpers";

const DEDUP_ATOL = 1e-6;

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

// Extract one coordinate column from polyhedraR.
// Equivalent to polyhedra_R.T[axis]
const coordColumn = (pts: number[][], axis: 0 | 1 | 2): number[] =>
    pts.map((p) => p[axis]);

/** Resultant geometry of the crystal */
export interface CrystalGeometry {
    /** Coordinates of each triangle (no shared vertices) */
    vertices: number[];
    /** Vertex colors */
    colors: number[];
    /** Maximum color index */
    maxColor: number;
    /** Triangles vertices index */
    index?: number[];
}

// > Main entry point
/**
 * From the planes compute the crystal shape
 *
 * @param basis - Structure basis
 * @param planes - Planes computed in the previous step
 * @param maxPlanes - Maximum number of planes to use (zero means all)
 * @returns Vertices and colors of the crystal surface
 */
export const buildCrystalShape = (
                                    basis: BasisType,
                                    planes: PlaneType[],
                                    maxPlanes: number,
                                    sendMsg: (msg: string) => void
                                ): CrystalGeometry => {

	// Planes used in the subsequent steps
	const planeMiller: number[][] = [];
	const planeEnergy: number[] = [];

	// Limit the number of planes
	const nPlanes = planes.length;
	if(maxPlanes > 0 && nPlanes >= maxPlanes) {

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

		for(let i=0; i < maxPlanes-3; ++i) {
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

	// Normalize the cell basis
	const cell: number[][] = [];
	for(let i=0, i3=0; i < 3; ++i, i3+=3) {
		cell.push([
			basis[i3],
			basis[i3+1],
			basis[i3+2]
		]);
	}

	// Compute normals
	const [planeNormals, planeRvalue] = getNormalsRvalues(planeMiller, planeEnergy, cell);

	const planeR = planeIntersections(planeNormals, planeRvalue);

    sendMsg("Searching interior polyhedra vertices");

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

    sendMsg("Calculating surface triangulation");

    // ─── Step 1: blng  (shape: numPlanes × numVertices) ──────────────────────────
    // Python: blng = np.isclose(np.dot(polyhedra_R, plane_normals.T), plane_rvalue).astype(int).T
    //
    // For each vertex v and each plane p: is dot(v, normal_p) ≈ rvalue_p ?
    // Then transpose so outer index = plane, inner index = vertex.

    const blng: number[][] = planeNormals.map((normal, p) =>
        polyhedraR.map((v) => (isClose(dot3(v, normal), planeRvalue[p]) ? 1 : 0))
    );
    // blng[p][v] === 1  ↔  vertex v lies on plane p

    // ─── Step 2: present_planes ──────────────────────────────────────────────────
    // Python: present_planes = (blng.sum(axis=1) >= 3).nonzero()[0]
    // A plane is "present" if it contains at least 3 vertices.

    const presentPlanes: number[] = blng
                                        .map((row, p) => ({p, sum: row.reduce((a, b) => a + b, 0)}))
                                        .filter(({sum}) => sum >= 3)
                                        .map(({p}) => p);

    // ─── Step 3: pp, pm, pe ──────────────────────────────────────────────────────
    // Python: pp = present_planes[0 : present_planes.size/2]

    // const pp: number[] = presentPlanes.slice(0, Math.floor(presentPlanes.length / 2));
    // const pm: number[][] = pp.map(i => planeMiller[i]);
    // const pe: number[]  = pp.map(i => planeEnergy[i]);

    // ─── Step 4: triangulate each plane face ─────────────────────────────────────

    const vertices: number[][][] = [];   // vertices[face] = array of simplex index-triples
    const colors: number[][]     = [];   // colors[face]   = array of face-color indices (one per simplex)
    // const faceSquare: number[]   = [];   // faceSquare[face] = scalar area accumulator

    let count = 0;

    for(const plane of presentPlanes) {
// console.log("===== plane:", plane);
        // Vertices that lie on this plane
        const onPlane: number[] = blng[plane]
                                    .map((flag, vi) => (flag === 1 ? vi : -1))
                                    .filter((vi) => vi !== -1);
// console.log("ONPLANE:", onPlane);
        const vert: number[][] = onPlane.map((vi) => polyhedraR[vi]);
// console.log("VERT:", vert);
        // Project onto the plane's local 2-D coordinate system.
        // Python: vert_flat = delete(dot(vert - vert[0], inv([v1-v0, v2-v0, normal])), col=2)
        // eslint-disable-next-line sonarjs/destructuring-assignment-syntax
        const v0 = vert[0];
        const v1 = vert[1];
        const v2 = vert[2];
        // const [v0, v1, v2] = vert;
        const base: number[][] = [sub3(v1, v0), sub3(v2, v0), planeNormals[plane]];
        const basisInv = inv3(base)!;

        const vertFlat: number[][] = vert.map((v) => {
            const local = mulVecMat3(sub3(v, v0), basisInv);
            return [local[0], local[1]];   // drop z (column 2) = normal component
        });

        // Delaunay triangulation in 2-D
        // delaunator expects a flat [x0,y0, x1,y1, ...] array
        const flat = new Float64Array(vertFlat.length * 2);
        let idx = 0;
        for(const [x, y] of vertFlat) {
            flat[idx++] = x;
            flat[idx++] = y;
        }
// console.log("FLAT:", flat);
        const del = new Delaunator(flat as unknown as number[]);
        // const del = Delaunator.from(flat as unknown as number[]);
        // const del = Delaunator.from(flat as unknown as ArrayLike<number[]>);
// console.log("DEL:", del);
        // del.triangles is a flat Uint32Array of simplex indices (groups of 3)
        const simplices: [number, number, number][] = [];
        for(let t = 0; t < del.triangles.length; t += 3) {
            simplices.push([del.triangles[t], del.triangles[t + 1], del.triangles[t + 2]]);
        }
// console.log("SIMPLICES:", simplices);

        // Map local simplex indices back to global polyhedra_R indices
        vertices.push(simplices.map(([a, b, c]) => [onPlane[a], onPlane[b], onPlane[c]]));
// console.log("VERTICES:", simplices.map(([a, b, c]) => [onPlane[a], onPlane[b], onPlane[c]]));

        // Color: every simplex on this face gets the same `count`
        colors.push(Array<number>(simplices.length).fill(count));

        // Face area: sum |cross(v2-v0, v1-v0)| over all simplices
        // Python: simplices_vert = vert[tri.simplices].transpose([1,0,2])
        //         face_square += |cross(sv[2]-sv[0], sv[1]-sv[0])|.sum()
        // const area = simplices.reduce((acc, [a, b, c]) => {
        //     const va = vert[a], vb = vert[b], vc = vert[c];
        //     return acc + absSum3(cross3(sub3(vc, va), sub3(vb, va)));
        // }, 0);
        // faceSquare.push(area);

        count++;
    }

    // ─── Step 5: flatten ─────────────────────────────────────────────────────────

    const verticesFlat: number[][] = vertices.flat();
    const colorsFlat:   number[]   = colors.flat();

    // ─── Triangulation ───────────────────────────────────────────────────────────
    // matplotlib's Triangulation stores x, y, and the triangle index array.
    // get_masked_triangles() returns the triangles unchanged when there is no mask
    // (which is the case here since no mask is supplied).

    const x: number[] = coordColumn(polyhedraR, 0);
    const y: number[] = coordColumn(polyhedraR, 1);
    const z: number[] = coordColumn(polyhedraR, 2);

    // triangles == vertices_flat (no mask applied)
    // const triangles: [number, number, number][] = verticesFlat;

    // console.log("TRI: x =", x, "y =", y, "triangles =", verticesFlat);
    // console.log("TRIANGLES:", verticesFlat);

    // ─── Build verts ─────────────────────────────────────────────────────────────
    // Python:
    //   xt = tri.x[triangles][..., np.newaxis]   shape: (nTri, 3, 1)
    //   yt = tri.y[triangles][..., np.newaxis]   shape: (nTri, 3, 1)
    //   zt = tri.z[triangles][..., np.newaxis]   shape: (nTri, 3, 1)
    //   verts = np.concatenate((xt, yt, zt), axis=2)  shape: (nTri, 3, 3)
    //
    // Result: verts[i][j] = [x, y, z] of the j-th vertex of the i-th triangle.

    // const verts: number[][][] = verticesFlat.map(([a, b, c]) => [
    //     [x[a], y[a], z[a]],
    //     [x[b], y[b], z[b]],
    //     [x[c], y[c], z[c]],
    // ]);

    const coordinates: number[] = [];
    const vertexColors: number[] = [];
    let i = 0;
    let maxColor = -1;
    for(const [a, b, c] of verticesFlat) {

        coordinates.push(x[a], y[a], z[a],
                         x[b], y[b], z[b],
                         x[c], y[c], z[c]);

        const cf = colorsFlat[i];
        if(cf > maxColor) maxColor = cf;
        vertexColors.push(cf, cf, cf);
        ++i;
    }

    return {
        vertices: coordinates,
        colors: vertexColors,
        maxColor
    };
};
