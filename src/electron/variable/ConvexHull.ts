/**
 * Computations to prepare data related to convex hull
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-02-05
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
import {quickHull, type Facet} from "@derschmale/tympanum";
import type {VariableCompositionAccumulator} from "./Accumulator";
import type {CtrlParams} from "@/types";

/**
 * Interface to the convex hull in the variable composition space
 */
export class VariableCompositionConvexHull {

	private readonly accumulator: VariableCompositionAccumulator;
	private dimension = 0;
	private x: number[] = [];
	private y: number[] = [];
	private z: number[] = [];
	private e: number[] = [];
	private step: number[] = [];
	private parts: string[] = [];
	private formula: string[] = [];
	private vertices: number[] = [];
	private idxVertices: number[] = [];
	private distances: number[] = [];

	private readonly trianglesVertices: number[] = [];

	/**
	 * Build the convex hull in variable composition space
	 *
	 * @param accumulator - Accumulate structures
	 */
	constructor(accumulator: VariableCompositionAccumulator) {

		this.accumulator = accumulator;
	}

	/**
	 * Remove coincident points in composition space for four components
	 *
	 * @param p - Proportions (barycentric coordinates) for each point
	 * @returns List of points for the convex hull routine and mapping to the original point
	 */
	private preparePointsForConvexHull4D(p: number[][]): {points: number[][]; idx: number[]} {

		// For coincident configurations retain only the one with minimal energy
		const minEnergies = new Map<string, {idx: number; energy: number}>();

		const len = this.e.length;
		for(let i=0; i < len; ++i) {
			const key = this.parts[i];
			if(minEnergies.has(key)) {
				const entry = minEnergies.get(key)!;
				const tol = Math.max(1e-8, Math.abs(entry.energy) * 1e-6);
				if((this.e[i] < (entry.energy - tol)) ||
				   (Math.abs(this.e[i] - entry.energy) <= tol && i < entry.idx)) {
					minEnergies.set(key, {idx: i, energy: this.e[i]});
				}
			}
			else {
				minEnergies.set(key, {idx: i, energy: this.e[i]});
			}
		}

		const validIdx = minEnergies
							.values()
							.map((entry) => entry.idx)
							.toArray()
							.toSorted((a, b) => a-b);

		const points: number[][] = [];
		for(const i of validIdx) {
			points.push([p[i][0], p[i][1], p[i][2], this.e[i]]);
		}

		return {points, idx: validIdx};
	}

	// > Prepare data
	/**
	 * Compute data related to the convex hull
	 *
	 * @param dimension - Number of components
	 * @returns Empty string on success, otherwise error message
	 */
	prepareData(dimension: number): string {

		if(!this.accumulator.hasEnergies()) {
			this.dimension = 0;
			return "Structures have no energies";
		}

		this.dimension = dimension;

		switch(dimension) {
			case 2: return this.prepareDim2Data();
			case 3: return this.prepareDim3Data();
			case 4: return this.prepareDim4Data();
		}
		this.dimension = 0;
		return "Invalid dimension";
	}

	/**
	 * Compute data related to the convex hull for two components
	 *
	 * @returns Empty string on success, otherwise error message
	 */
	private prepareDim2Data(): string {

		// Find extremes
		let e0 = Number.POSITIVE_INFINITY;
		let e1 = Number.POSITIVE_INFINITY;

		this.x.length = 0;
		this.e.length = 0;
		this.step.length = 0;
		this.parts.length = 0;
		this.formula.length = 0;
		for(const structure of this.accumulator.iterateEnabledStructures()) {

			const {parts, step, energy, key, formula} = structure;

			const structureEnergy = energy ?? 0;
			this.x.push(parts[1]/(parts[0]+parts[1]));
			this.e.push(structureEnergy);
			this.step.push(step);
			this.parts.push(key);
			this.formula.push(formula);
			if(parts[0] === 1 &&
			   parts[1] === 0 &&
			   structureEnergy < e0) {
				e0 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 1 &&
					structureEnergy < e1) {
						e1 = structureEnergy;
			}
		}

		if(e0 === Number.POSITIVE_INFINITY || e1 === Number.POSITIVE_INFINITY) {
			return "Missing end-members";
		}

		// Find enthalpy of formation
		let len = this.e.length;
		for(let i=0; i < len; ++i) this.e[i] -= e0+this.x[i]*(e1-e0);

		// Prepare the points for the convex hull
		const points: number[][] = [];
		for(let i=0; i < len; ++i) {
			points.push([this.x[i], this.e[i]]);
		}

		// Find convex hull (only the lower part)
		// The facet is encoded as (normal[2], offset)
		const hull = quickHull(points);
		const toOrder: {x: number; y: number; idx: number}[] = [];
		for(const facet of hull) {
			if(facet.plane[1] < -1e-13) {
				const [v1, v2] = facet.verts;

				toOrder.push({x: points[v1][0], y: points[v1][1], idx: v1},
							 {x: points[v2][0], y: points[v2][1], idx: v2});
			}
		}

		// Sort convex hull points by increasing x value
		toOrder.sort((a, b) => {
			if(a.x !== b.x) return a.x - b.x;
			return a.y - b.y;
		});

		// Remove duplicated convex hull points
    	len = toOrder.length;
		this.vertices = [toOrder[0].x, toOrder[0].y];
		this.idxVertices = [toOrder[0].idx];
	    for(let i=0, j=1; j < len; ++j) {
			if(Math.abs(toOrder[i].x-toOrder[j].x) > 1e-4 ||
			   Math.abs(toOrder[i].y-toOrder[j].y) > 1e-4) {
				this.vertices.push(toOrder[j].x, toOrder[j].y);
				this.idxVertices.push(toOrder[j].idx);
				i = j;
			}
		}

		// Add distances from the convex hull
		this.distances = this.distanceFromConvexHull2D();

		return "";
	}

	/**
	 * Compute data related to the convex hull for three components
	 *
	 * @returns Empty string on success, otherwise error message
	 */
	private prepareDim3Data(): string {

		// Find extremes
		let e0 = Number.POSITIVE_INFINITY;
		let e1 = Number.POSITIVE_INFINITY;
		let e2 = Number.POSITIVE_INFINITY;

		this.x.length = 0;
		this.y.length = 0;
		this.e.length = 0;
		this.step.length = 0;
		this.parts.length = 0;
		this.formula.length = 0;

		const p: number[][] = [];
		for(const structure of this.accumulator.iterateEnabledStructures()) {

			const {parts, step, energy, key, formula} = structure;

			const structureEnergy = energy ?? 0;
			this.step.push(step);
			this.parts.push(key);
			this.formula.push(formula);
			if(parts[0] === 1 &&
			   parts[1] === 0 &&
			   parts[2] === 0 &&
			   structureEnergy < e0) {
				e0 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 1 &&
				    parts[2] === 0 &&
					structureEnergy < e1) {
						e1 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 0 &&
				    parts[2] === 1 &&
					structureEnergy < e2) {
						e2 = structureEnergy;
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
			this.x.push(p1+p2*0.5);
			this.y.push(p2*0.8660254038);
			this.e.push(structureEnergy);
		}

		if(e0 === Number.POSITIVE_INFINITY ||
		   e1 === Number.POSITIVE_INFINITY ||
		   e2 === Number.POSITIVE_INFINITY) {
			return "Missing end-members";
		}

		// Find enthalpy of formation
		const len = this.e.length;
		for(let i=0; i < len; ++i) this.e[i] -= p[i][0]*e0+p[i][1]*e1+p[i][2]*e2;

		// Prepare the points for the convex hull
		const points: number[][] = [];
		for(let i=0; i < len; ++i) {
			points.push([this.x[i], this.y[i], this.e[i]]);
		}

		// Find convex hull (only the lower part)
		// The facet is encoded as (normal[3], offset)
		this.trianglesVertices.length = 0;
		const hull = quickHull(points);
		const idxVertices = new Set<number>();
		for(const facet of hull) {
			if(facet.plane[2] < -1e-13) {
				const [v1, v2, v3] = facet.verts;
				idxVertices.add(v1);
				idxVertices.add(v2);
				idxVertices.add(v3);
				this.trianglesVertices.push(points[v1][0], points[v1][1], points[v1][2],
											points[v2][0], points[v2][1], points[v2][2],
											points[v3][0], points[v3][1], points[v3][2]);
			}
		}

		this.vertices = [];
		this.idxVertices = [...idxVertices];
		for(const idx of idxVertices) {
			this.vertices.push(points[idx][0], points[idx][1], points[idx][2]);
		}

		// Add distances from the convex hull
		this.distances = this.distanceFromConvexHull3D(points, hull);

		return "";
	}

	/**
	 * Compute data related to the convex hull for four components
	 *
	 * @returns Empty string on success, otherwise error message
	 */
	private prepareDim4Data(): string {

		// Find extremes
		let e0 = Number.POSITIVE_INFINITY;
		let e1 = Number.POSITIVE_INFINITY;
		let e2 = Number.POSITIVE_INFINITY;
		let e3 = Number.POSITIVE_INFINITY;

		this.x.length = 0;
		this.y.length = 0;
		this.z.length = 0;
		this.e.length = 0;
		this.step.length = 0;
		this.parts.length = 0;
		this.formula.length = 0;

		const p: number[][] = [];
		for(const structure of this.accumulator.iterateEnabledStructures()) {

			const {parts, step, energy, key, formula} = structure;
			const structureEnergy = energy ?? 0;

			this.e.push(structureEnergy);
			if(parts[0] === 1 &&
			   parts[1] === 0 &&
			   parts[2] === 0 &&
			   parts[3] === 0 &&
			   structureEnergy < e0) {
						e0 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 1 &&
				    parts[2] === 0 &&
			   		parts[3] === 0 &&
					structureEnergy < e1) {
						e1 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 0 &&
				    parts[2] === 1 &&
			   		parts[3] === 0 &&
					structureEnergy < e2) {
						e2 = structureEnergy;
			}
			else if(parts[0] === 0 &&
				    parts[1] === 0 &&
				    parts[2] === 0 &&
			   		parts[3] === 1 &&
					structureEnergy < e3) {
						e3 = structureEnergy;
			}
			this.step.push(step);
			this.parts.push(key);
			this.formula.push(formula);

			// Compute the component proportions that are
			// the barycentric coordinates of the point in the tetrahedra
			const pt = parts[0]+parts[1]+parts[2]+parts[3];
			const p0 = parts[0]/pt;
			const p1 = parts[1]/pt;
			const p2 = parts[2]/pt;
			const p3 = parts[3]/pt;
			p.push([p0, p1, p2, p3]);

			// Using barycentric coordinates
			// const x = p0*0+p1*1+p2*0.5         +p3*0.5;
			// const y = p0*0+p1*0+p2*0.8660254038+p3*0.2886751346;
			// const z = p0*0+p1*0+p2*0           +p3*0.8660254038;
			this.x.push(p1+(p2+p3)*0.5);
			this.y.push(p2*0.8660254038+p3*0.2886751346);
			this.z.push(p3*0.8660254038);
		}

		if(e0 === Number.POSITIVE_INFINITY ||
		   e1 === Number.POSITIVE_INFINITY ||
		   e2 === Number.POSITIVE_INFINITY ||
		   e3 === Number.POSITIVE_INFINITY) {
			return "Missing end-members";
		}

		// Find enthalpy of formation
		const len = this.e.length;
		for(let i=0; i < len; ++i) this.e[i] -= p[i][0]*e0+p[i][1]*e1+p[i][2]*e2+p[i][3]*e3;

		// Remove coincident points for computing the convex hull
		// idx maps index in points to original point
		const {points, idx} = this.preparePointsForConvexHull4D(p);

		// Find convex hull (only the lower part)
		// The facet is encoded as (normal[4], offset)
		const hull = quickHull(points);
		const idxVertices = new Set<number>();
		const facetA: number[][] = [];
		const facetC: number[] = [];
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
				this.trianglesVertices.push(this.x[w1], this.y[w1], this.z[w1],
											this.x[w2], this.y[w2], this.z[w2],
											this.x[w3], this.y[w3], this.z[w3],

											this.x[w1], this.y[w1], this.z[w1],
											this.x[w2], this.y[w2], this.z[w2],
											this.x[w4], this.y[w4], this.z[w4],

											this.x[w4], this.y[w4], this.z[w4],
											this.x[w2], this.y[w2], this.z[w2],
											this.x[w3], this.y[w3], this.z[w3],

											this.x[w4], this.y[w4], this.z[w4],
											this.x[w3], this.y[w3], this.z[w3],
											this.x[w1], this.y[w1], this.z[w1]);

				// Hyperplane coordinates to compute distance from the facet
				const a = [
					-facet.plane[0]/facet.plane[3],
					-facet.plane[1]/facet.plane[3],
					-facet.plane[2]/facet.plane[3]
				];
				facetA.push(a);

				const c = -facet.plane[4]/facet.plane[3];
				facetC.push(c);
			}
		}

		this.vertices = [];
		this.idxVertices = [...idxVertices];
		for(const i of idxVertices) {
			this.vertices.push(this.x[i], this.y[i], this.z[i]);
		}

		// Add distances from the convex hull
		this.distances = this.distanceFromConvexHull4D(p, idxVertices, facetA, facetC);

		return "";
	}

	// > Distances computations
	/**
	 * Distances of 2D points from the convex hull line
	 *
	 * @returns Distances of the points from the convex hull line
	 */
	private distanceFromConvexHull2D(): number[] {

		const npoints = this.x.length;
		const distances = Array<number>(npoints).fill(0);

		for(let i=0; i < npoints; ++i) {

			const xx = this.x[i];
			for(let j=2; j < this.vertices.length; j+=2) {
				if(this.vertices[j] >= xx) {
					const m = (this.vertices[j+1] - this.vertices[j-1]) /
							  (this.vertices[j]   - this.vertices[j-2]);
					const yl = (xx-this.vertices[j-2])*m+this.vertices[j-1];
					distances[i] = this.e[i]-yl;
					break;
				}
			}
		}

		return distances;
	}

	/**
	 * Compute barycentric coordinates on the XY plane
	 * @remarks Algorithm from: https://blackpawn.com/texts/pointinpoly/
	 *  - u corresponds to c vertex
	 *  - v corresponds to b vertex
	 *  - w corresponds to a vertex
	 *
	 * @param point - Point to test (only x and y used)
	 * @param a - Vertex of the triangle (only x and y used)
	 * @param b - Vertex of the triangle (only x and y used)
	 * @param c - Vertex of the triangle (only x and y used)
	 * @returns Barycentric coordinates [u, v, w] of the point
	 */
	private barycentricCoordinates(point: number[],
								   a: number[],
								   b: number[],
								   c: number[]): [number, number, number] {

		// Compute vectors and dot products
		const [cx, cy] = point;
		const v0x = c[0]-a[0];
		const v0y = c[1]-a[1];
		const v1x = b[0]-a[0];
		const v1y = b[1]-a[1];
		const v2x = cx-a[0];
		const v2y = cy-a[1];
		const dot00 = v0x*v0x + v0y*v0y;
		const dot01 = v0x*v1x + v0y*v1y;
		const dot02 = v0x*v2x + v0y*v2y;
		const dot11 = v1x*v1x + v1y*v1y;
		const dot12 = v1x*v2x + v1y*v2y;

		// Compute barycentric coordinates
		const d = (dot00 * dot11 - dot01 * dot01);
		const inv = d === 0 ? 0 : (1 / d);
		const u = (dot11*dot02 - dot01*dot12) * inv;
		const v = (dot00*dot12 - dot01*dot02) * inv;

		return [u, v, 1-u-v];
	}

	/**
	 * Distance from the closest point inside the triangle along Z axis
	 * @remarks Algorithm from: https://blackpawn.com/texts/pointinpoly/
	 *
	 * @param p - Point to test
	 * @param a - Vertex of the triangle
	 * @param b - Vertex of the triangle
	 * @param c - Vertex of the triangle
	 * @returns Distance from the triangle or -1 if the point is not perpendicular to the triangle
	 */
	closestPointTriangleAlongZ(p: number[], a: number[], b: number[], c: number[]): number {

		const [u, v, w] = this.barycentricCoordinates(p, a, b, c);
		if(u >= 0 && v >= 0 && w >= 0) {

			const z = u*c[2]+v*b[2]+w*a[2];
			return p[2]-z;
		}
		return -1;
	}

	/**
	 * Distances of 3D points from the convex hull triangulated surface
	 *
	 * @param points - Points coordinates
	 * @param hull - Convex hull facets
	 * @returns Distances of the points from the surface
	 */
	private distanceFromConvexHull3D(points: number[][], hull: Facet[]): number[] {

		const distances: number[] = [];
		for(const point of points) {

			let dist = Number.POSITIVE_INFINITY;
			for(const facet of hull) {
				if(facet.plane[2] < -1e-13) {

					const [v1, v2, v3] = facet.verts;

					// Test if closest triangle
					const d = this.closestPointTriangleAlongZ(point,
															  points[v1],
															  points[v2],
															  points[v3]);
					if(d !== -1 && d < dist) dist = d;
				}
			}
			distances.push(dist);
		}

		return distances;
	}

	/**
	 * Distances of 4D points from the convex hull triangulated surface
	 *
	 * @param parts - List of parts for each structure
	 * @param idxVertices - Index of the points that are vertices for the convex hull
	 * @param facetA - Hyperplane a parameter from the convex hull
	 * @param facetC - Hyperplane c parameter from the convex hull
	 * @returns Minimal distance from the convex hull for each structure
	 */
	private distanceFromConvexHull4D(parts: number[][],
									 idxVertices: Set<number>,
									 facetA: number[][],
									 facetC: number[]): number[] {

		const distances: number[] = [];

		for(let idx = 0; idx < parts.length; ++idx) {

			if(idxVertices.has(idx)) {
				distances.push(0);
				continue;
			}

			const part = parts[idx];
			let eHull = Number.NEGATIVE_INFINITY;
			for(let i=0; i < facetA.length; ++i) {

				const eh = facetA[i][0]*part[0] +
						   facetA[i][1]*part[1] +
						   facetA[i][2]*part[2] +
						   facetC[i];
				if(eh > eHull) eHull = eh;
			}

			const diff = this.e[idx]-eHull;
			distances.push(diff < 1e-8 ? 0 : diff);
		}

		return distances;
	}

	/**
	 * Update distances in the accumulator from the convex hull
	 */
	updateDistances(): void {

		if(this.distances.length === 0) {
			for(const entry of this.accumulator.iterateEnabledStructures()) {

				entry.distance = -1;
			}
			return;
		}

		let idx = 0;
		for(const entry of this.accumulator.iterateEnabledStructures()) {

			entry.distance = this.distances[idx++];
		}
	}

	/**
	 * Extract data for display
	 *
	 * @returns Data to be passed to the secondary window for display
	 */
	dataForDisplay(): CtrlParams {

		switch(this.dimension) {
			case 2: return {
				dimension: 2,
				x: this.x,
				e: this.e,
				step: this.step,
				parts: this.parts,
				vertices: this.vertices,
				idxVertices: this.idxVertices,
				distance: this.distances,
				formula: this.formula
			};
			case 3: return {
				dimension: 3,
				trianglesVertices: this.trianglesVertices,
				x: this.x,
				y: this.y,
				e: this.e,
				step: this.step,
				parts: this.parts,
				vertices: this.vertices,
				idxVertices: this.idxVertices,
				distance: this.distances,
				formula: this.formula
			};
			case 4: return {
				dimension: 4,
				x: this.x,
				y: this.y,
				z: this.z,
				e: this.e,
				step: this.step,
				parts: this.parts,
				vertices: this.vertices,
				idxVertices: this.idxVertices,
				distance: this.distances,
				formula: this.formula
			};
		}
		return {error: `Invalid dimension ${this.dimension}`};
	}

	/**
	 * Extract data for display in 3D view
	 *
	 * @returns Data to be passed to the secondary window for display
	 */
	dataForDisplay3D(): CtrlParams {

		switch(this.dimension) {
			case 3: return {
				dimension: 3,
				trianglesVertices: this.trianglesVertices,
				x: this.x,
				y: this.y,
				e: this.e,
				vertices: this.vertices,
				step: this.step,
				parts: this.parts,
				distance: this.distances,
				formula: this.formula,
				idxVertices: this.idxVertices
			};
			case 4: return {
				dimension: 4,
				trianglesVertices: this.trianglesVertices,
				x: this.x,
				y: this.y,
				z: this.z,
				e: this.e,
				vertices: this.vertices,
				step: this.step,
				parts: this.parts,
				distance: this.distances,
				formula: this.formula,
				idxVertices: this.idxVertices,
			};
		}
		return {error: `Invalid dimension ${this.dimension} for 3D view`};
	}
}
