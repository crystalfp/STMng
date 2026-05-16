/**
 * Compute enthalpy transition under pressure changes for variable composition.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-14
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
import {convexHull2D} from "./ConvexHull2D";
import {quickHull} from "@derschmale/tympanum";
import type {StructureSetsAccumulator} from "./Accumulator";

/** Enthalpy transitions */
export interface VariableTransitionTable {
	/** Transition pressure ranges */
	pressures: [number, number][];
	/** Structure step for each range */
	steps: number[][];
	/** Structure formula for each range */
	formulas: string[][];
}

/** Convex hull vertex */
interface Vertex {
	/** Corresponding step */
	step: number;
	/** And formula (HTML formatted) */
	formula: string;
}

/**
 * Compute convex hull vertices for 2 components
 *
 * @param pressure - Pressure at which convex hull vertices should be computed
 * @param accumulator - Accumulated structures
 * @returns List of vertices at the given pressure
 */
const computeVertices2D = (pressure: number, accumulator: StructureSetsAccumulator): Vertex[] => {

	// Find extremes
	let e0 = Number.POSITIVE_INFINITY;
	let e1 = Number.POSITIVE_INFINITY;

	const x = [];
	const e = [];
	const s = [];
	const f = [];

	for(const structure of accumulator.iterateEnabledStructures()) {

		const {parts, step, energyPerAtom, formula, volume} = structure;

		const energy = energyPerAtom + pressure*volume/160.218;
		x.push(parts[1]/(parts[0]+parts[1]));
		e.push(energy);
		s.push(step);
		f.push(formula);

		if(parts[0] === 1 &&
		   parts[1] === 0 &&
			energy < e0) {
			e0 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 1 &&
				energy < e1) {
			e1 = energy;
		}
	}

	if(e0 === Number.POSITIVE_INFINITY || e1 === Number.POSITIVE_INFINITY) {
		throw Error("Missing end-members");
	}

	// Find enthalpy of formation
	const len = e.length;
	for(let i=0; i < len; ++i) e[i] -= e0+x[i]*(e1-e0);

	// Prepare the points for the convex hull
	const points: number[][] = [];
	for(let i=0; i < len; ++i) {
		points.push([x[i], e[i]]);
	}

	// Find convex hull (only the lower part)
	const {index} = convexHull2D(points);

	const out: Vertex[] = [];
	for(const idx of index) {
		out.push({step: s[idx], formula: f[idx]});
	}

	return out;
};

/**
 * Compute convex hull vertices for 3 components
 *
 * @param pressure - Pressure at which convex hull vertices should be computed
 * @param accumulator - Accumulated structures
 * @returns List of vertices at the given pressure
 */
const computeVertices3D = (pressure: number, accumulator: StructureSetsAccumulator): Vertex[] => {

	// Find extremes
	let e0 = Number.POSITIVE_INFINITY;
	let e1 = Number.POSITIVE_INFINITY;
	let e2 = Number.POSITIVE_INFINITY;

	const x = [];
	const y = [];
	const e = [];
	const s = [];
	const f = [];

	const p: number[][] = [];
	for(const structure of accumulator.iterateEnabledStructures()) {

		const {parts, step, energyPerAtom, volume, formula} = structure;

		const energy = energyPerAtom + pressure*volume/160.218;
		s.push(step);
		f.push(formula);
		if(parts[0] === 1 &&
			parts[1] === 0 &&
			parts[2] === 0 &&
			energy < e0) {
			e0 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 1 &&
				parts[2] === 0 &&
				energy < e1) {
					e1 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 0 &&
				parts[2] === 1 &&
				energy < e2) {
					e2 = energy;
		}

		// Compute the component proportions
		const pt = parts[0]+parts[1]+parts[2];
		const p0 = parts[0]/pt;
		const p1 = parts[1]/pt;
		const p2 = parts[2]/pt;
		p.push([p0, p1, p2]);

		// Using barycentric coordinates
		// const x = p0*0+p1*1+p2*0.5;
		// const y = p0*0+p1*0+p2*0.8660254038;
		x.push(p1+p2*0.5);
		y.push(p2*0.8660254038);
		e.push(energy);
	}

	if(e0 === Number.POSITIVE_INFINITY ||
	   e1 === Number.POSITIVE_INFINITY ||
	   e2 === Number.POSITIVE_INFINITY) {
		throw Error("Missing end-members");
	}

	// Find enthalpy of formation
	const len = e.length;
	for(let i=0; i < len; ++i) e[i] -= p[i][0]*e0+p[i][1]*e1+p[i][2]*e2;

	// Prepare the points for the convex hull
	const points: number[][] = [];
	for(let i=0; i < len; ++i) {
		points.push([x[i], y[i], e[i]]);
	}

	// Find convex hull (only the lower part)
	// The facet is encoded as (normal[3], offset)
	const hull = quickHull(points);
	const idxVertices = new Set<number>();
	for(const facet of hull) {
		if(facet.plane[2] < -1e-4) {
			const [v1, v2, v3] = facet.verts;
			idxVertices.add(v1);
			idxVertices.add(v2);
			idxVertices.add(v3);
		}
	}

	const out: Vertex[] = [];
	for(const idx of idxVertices) {
		out.push({step: s[idx], formula: f[idx]});
	}

	return out;
};

/**
 * Remove coincident points in composition space for four components
 *
 * @param p - Proportions (barycentric coordinates) for each point
 * @returns List of points for the convex hull routine and mapping to the original point
 */
const preparePointsForConvexHull4D = (p: number[][], e: number[], parts: string[]): {points: number[][]; idx: number[]} => {

	// For coincident configurations retain only the one with minimal energy
	const minEnergies = new Map<string, {idx: number; energy: number}>();

	const len = e.length;
	for(let i=0; i < len; ++i) {
		const key = parts[i];
		if(minEnergies.has(key)) {
			const entry = minEnergies.get(key)!;
			const tol = Math.max(1e-8, Math.abs(entry.energy) * 1e-6);
			if((e[i] < (entry.energy - tol)) ||
				(Math.abs(e[i] - entry.energy) <= tol && i < entry.idx)) {
				minEnergies.set(key, {idx: i, energy: e[i]});
			}
		}
		else {
			minEnergies.set(key, {idx: i, energy: e[i]});
		}
	}

	const validIdx = minEnergies
						.values()
						.map((entry) => entry.idx)
						.toArray()
						.toSorted((a, b) => a-b);

	const points: number[][] = [];
	for(const i of validIdx) {
		points.push([p[i][0], p[i][1], p[i][2], e[i]]);
	}

	return {points, idx: validIdx};
};

/**
 * Compute convex hull vertices for 4 components
 *
 * @param pressure - Pressure at which convex hull vertices should be computed
 * @param accumulator - Accumulated structures
 * @returns List of vertices at the given pressure
 */
const computeVertices4D = (pressure: number, accumulator: StructureSetsAccumulator): Vertex[] => {

	// Find extremes
	let e0 = Number.POSITIVE_INFINITY;
	let e1 = Number.POSITIVE_INFINITY;
	let e2 = Number.POSITIVE_INFINITY;
	let e3 = Number.POSITIVE_INFINITY;

	const e = [];
	const s = [];
	const f = [];
	const prt = [];

	const p: number[][] = [];
	for(const structure of accumulator.iterateEnabledStructures()) {

		const {parts, step, energyPerAtom, volume, formula, key} = structure;

		const energy = energyPerAtom + pressure*volume/160.218;

		e.push(energy);
		if(parts[0] === 1 &&
		   parts[1] === 0 &&
		   parts[2] === 0 &&
		   parts[3] === 0 &&
			energy < e0) {
					e0 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 1 &&
				parts[2] === 0 &&
				parts[3] === 0 &&
				energy < e1) {
					e1 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 0 &&
				parts[2] === 1 &&
				parts[3] === 0 &&
				energy < e2) {
					e2 = energy;
		}
		else if(parts[0] === 0 &&
				parts[1] === 0 &&
				parts[2] === 0 &&
				parts[3] === 1 &&
				energy < e3) {
					e3 = energy;
		}
		s.push(step);
		f.push(formula);
		prt.push(key);

		// Compute the component proportions that are
		// the barycentric coordinates of the point in the tetrahedra
		const pt = parts[0]+parts[1]+parts[2]+parts[3];
		const p0 = parts[0]/pt;
		const p1 = parts[1]/pt;
		const p2 = parts[2]/pt;
		const p3 = parts[3]/pt;
		p.push([p0, p1, p2, p3]);
	}

	if(e0 === Number.POSITIVE_INFINITY ||
	   e1 === Number.POSITIVE_INFINITY ||
	   e2 === Number.POSITIVE_INFINITY ||
	   e3 === Number.POSITIVE_INFINITY) {
		throw Error("Missing end-members");
	}

	// Find enthalpy of formation
	const len = e.length;
	for(let i=0; i < len; ++i) e[i] -= p[i][0]*e0+p[i][1]*e1+p[i][2]*e2+p[i][3]*e3;

	// Remove coincident points for computing the convex hull
	// idx maps index in points to original point
	const {points, idx} = preparePointsForConvexHull4D(p, e, prt);

	// Find convex hull (only the lower part)
	// The facet is encoded as (normal[4], offset)
	const hull = quickHull(points);
	const idxVertices = new Set<number>();
	for(const facet of hull) {

		if(facet.plane[3] < -1e-4) {

			const [v1, v2, v3, v4] = facet.verts;
			const w1 = idx[v1];
			const w2 = idx[v2];
			const w3 = idx[v3];
			const w4 = idx[v4];
			idxVertices.add(w1);
			idxVertices.add(w2);
			idxVertices.add(w3);
			idxVertices.add(w4);
		}
	}

	const out: Vertex[] = [];
	for(const i of idxVertices) {
		out.push({step: s[i], formula: f[i]});
	}

	return out;
};

/**
 * Compute vertex structures at the given pressure
 *
 * @param pressure - Pressure at which to compute the convex hull
 * @param accumulator - Loaded structures
 * @param numberComponents - Number of components (2-4)
 * @returns Array of vertices at the given pressure
 */
const computeVertices = (pressure: number,
						 accumulator: StructureSetsAccumulator,
						 numberComponents: number): Vertex[] => {

	switch(numberComponents) {
		case 2:	return computeVertices2D(pressure, accumulator);
		case 3:	return computeVertices3D(pressure, accumulator);
		case 4:	return computeVertices4D(pressure, accumulator);
		default: return [];
	}
};

/**
 * Compare transition data
 *
 * @param previous - Previous transition data
 * @param current - Current transition data
 * @returns True if the two sets differ
 */
const verticesDiffer = (previous: Map<number, string>, current: Vertex[]): boolean => {

	if(previous.size !== current.length) return true;

	for(const entry of current) {

		if(!previous.has(entry.step)) return true;
	}
	return false;
};

/**
 * Compute enthalpy transitions for variable compositions
 *
 * @param accumulator - Accumulated structures
 * @param numberComponents - Number components
 * @returns Table of enthalpy structures transitions
 */
export const computeTransitionsVariable = (
					accumulator: StructureSetsAccumulator,
				 	numberComponents: number): VariableTransitionTable => {

	const out: VariableTransitionTable = {
		pressures: [],
		steps: [],
		formulas: []
	};

	const RANGE_MIN  = -100;
	const RANGE_MAX  =  200;
	const RANGE_INCR =  0.1;

	// Initialize
	let pressurePrevious = RANGE_MIN;
	const verticesPrevious = new Map<number, string>();
	const entries = computeVertices(RANGE_MIN, accumulator, numberComponents);
	for(const entry of entries) verticesPrevious.set(entry.step, entry.formula);

	// Variate
	for(let pressure = RANGE_MIN+RANGE_INCR; pressure < RANGE_MAX; pressure += RANGE_INCR) {

		const currentEntries = computeVertices(pressure, accumulator, numberComponents);

		if(verticesDiffer(verticesPrevious, currentEntries)) {

			out.pressures.push([pressurePrevious, pressure]);
			out.steps.push(verticesPrevious.keys().toArray());
			out.formulas.push(verticesPrevious.values().toArray());

			pressurePrevious = pressure;
			verticesPrevious.clear();
			for(const entry of currentEntries) verticesPrevious.set(entry.step, entry.formula);
		}
	}

	// Last step
	out.pressures.push([pressurePrevious, RANGE_MAX]);
	out.steps.push(verticesPrevious.keys().toArray());
	out.formulas.push(verticesPrevious.values().toArray());

	return out;
};
