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
import {dot} from "mathjs";
import type {CtrlParams} from "@/types";

/**
 * Interface to the convex hull in the variable composition space
 */
export class VariableCompositionConvexHull {

	private readonly accumulator: VariableCompositionAccumulator;
	private dimension = 0;
	private readonly x: number[] = [];
	private readonly y: number[] = [];
	private readonly z: number[] = [];
	private readonly e: number[] = [];
	private readonly step: number[] = [];
	private readonly parts: string[] = [];
	private readonly formula: string[] = [];
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

		// Find convex hull (only the lower part)
		const points: number[][] = [];
		for(let i=0; i < len; ++i) points.push([this.x[i], this.e[i]]);
		const hull = quickHull(points);
		const toOrder: {x: number; y: number; idx: number}[] = [];
		for(const facet of hull) {
			if(facet.plane[1] < 0) {
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

			const xx = p2 === 1 ? 0.5 : 0.5*p2+(1-p2)*p0/(p0+p1);
			this.x.push(xx);
			// x.push(0.5*p2+(1-p2)*p0);
			this.y.push(p2*0.8660254038); // √3/2
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

		// Find convex hull (only the lower part)
		this.trianglesVertices.length = 0;
		const points: number[][] = [];
		for(let i=0; i < len; ++i) points.push([this.x[i], this.y[i], this.e[i]]);
		const hull = quickHull(points);
		const idxVertices = new Set<number>();
		for(const facet of hull) {
			if(facet.plane[2] < 0) {
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

			// Compute the component proportions
			const pt = parts[0]+parts[1]+parts[2]+parts[3];
			const p0 = parts[0]/pt;
			const p1 = parts[1]/pt;
			const p2 = parts[2]/pt;
			const p3 = parts[3]/pt;
			p.push([p0, p1, p2, p3]);

			if(p3 === 1) {
				this.x.push(0.5);
				this.y.push(0.2886751346); // √3/6
				this.z.push(0.8660254038); // √3/2
			}
			else if(p2 === 1) {
				this.x.push(0.5);
				this.y.push(0.8660254038-0.5773502692*p3); // √3/2-√3/3*p3
				this.z.push(p3*0.8660254038); // √3/2
			}
			else {
				this.z.push(p3*0.8660254038); // √3/2

				const x0 = 0.5*p3;
				const y0 = 0.2886751346*p3;
				const x1 = 1-p3/2;
				// const y1 = y0;
				const x2 = 0.5;
				const y2 = 0.8660254038-0.5773502692*p3;

				this.y.push(y0+(y2-y0)*p2);
				const xa = x0 + (x2-x0)*p2;
				const xb = x1 + (x1-x2)*p2;
				this.x.push(xa+(xb-xa)*p1/(p0+p1));
			}
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

		// Find convex hull (only the lower part)
		const points: number[][] = [];
		for(let i=0; i < len; ++i) points.push([this.x[i], this.y[i], this.z[i], this.e[i]]);
		const hull = quickHull(points);
		const idxVertices = new Set<number>();
		for(const facet of hull) {
			if(facet.plane[3] < 0) {
				const [v1, v2, v3, v4] = facet.verts;
				idxVertices.add(v1);
				idxVertices.add(v2);
				idxVertices.add(v3);
				idxVertices.add(v4);
			}
		}

		this.vertices = [];
		this.idxVertices = [...idxVertices];
		for(const idx of idxVertices) {
			this.vertices.push(points[idx][0], points[idx][1], points[idx][2], points[idx][3]);
		}

		// Add distances from the convex hull
		this.distances = this.distanceFromConvexHull4D(points, hull);

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
	 * Check for points on the border of a triangle
	 *
	 * @param point - Point to test
	 * @param nearest - Nearest point
	 * @returns Zero if the points are coincident, otherwise -1
	 */
	private coincident(point: number[], nearest: number[]): number {

		const dx = point[0] - nearest[0];
		const dy = point[1] - nearest[1];
		const dz = point[2] - nearest[2];
		return Math.abs(dx*dx + dy*dy + dz*dz) < 1e-10 ? 0 : -1;
	}

	/**
	 * Distance from the closest point inside the triangle
	 * @remarks Code ported from: https://stackoverflow.com/questions/2924795/fastest-way-to-compute-point-to-triangle-distance-in-3d/74395029
	 *
	 * @param p - Point to test
	 * @param a - Vertex of the triangle
	 * @param b - Vertex of the triangle
	 * @param c - Vertex of the triangle
	 * @returns Distance from the triangle or -1 if the point is not perpendicular to the triangle
	 */
	private closestPointTriangle(p: number[], a: number[], b: number[], c: number[]): number {

		const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];

		const d1 = dot(ab, ap);
		const d2 = dot(ac, ap);
		if(d1 <= 0 && d2 <= 0) return this.coincident(p, a); // #1

		const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
		const d3 = dot(ab, bp);
		const d4 = dot(ac, bp);
		if(d3 >= 0 && d4 <= d3) return this.coincident(p, b); // #2

		const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  		const d5 = dot(ab, cp);
  		const d6 = dot(ac, cp);
  		if(d6 >= 0 && d5 <= d6) return this.coincident(p, c); // #3

  		const vc = d1 * d4 - d3 * d2;
		if(vc <= 0 && d1 >= 0 && d3 <= 0) {

			const v = d1 / (d1 - d3);
			const x = [
				a[0] + v * ab[0],
				a[1] + v * ab[1],
				a[2] + v * ab[2]
			];

			return this.coincident(p, x); // #4
		}

		const vb = d5 * d2 - d1 * d6;
  		if(vb <= 0 && d2 >= 0 && d6 <= 0) {

			const v = d2 / (d2 - d6);
			const x = [
				a[0] + v * ac[0],
				a[1] + v * ac[1],
				a[2] + v * ac[2]
			];

			return this.coincident(p, x); // #5
		}

  		const va = d3 * d6 - d5 * d4;
  		if(va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {

			const v = (d4 - d3) / ((d4 - d3) + (d5 - d6));
			const x = [
				b[0] + v*(c[0]-b[0]),
				b[1] + v*(c[1]-b[1]),
				b[2] + v*(c[2]-b[2])
			];

			return this.coincident(p, x); // #6
		}

		const denom = 1 / (va + vb + vc);
		const v = vb * denom;
		const w = vc * denom;
		const q = [
			a[0] + v * ab[0] + w * ac[0],
			a[1] + v * ab[1] + w * ac[1],
			a[2] + v * ab[2] + w * ac[2]
		];
		// return a + v * ab + w * ac; //#0
		return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
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
				if(facet.plane[2] < 0) {

					const [v1, v2, v3] = facet.verts;

					// Test if closest triangle
					const d = this.closestPointTriangle(point, points[v1], points[v2], points[v3]);
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
	 * @param points - Points coordinates
	 * @param hull - Convex hull facets
	 * @returns Distances of the points from the surface
	 */
	private distanceFromConvexHull4D(points: number[][], hull: Facet[]): number[] {

		const vertices = [
			[0, 1, 2],
			[0, 2, 3],
			[0, 1, 3],
			[1, 2, 3]
		];
		const distances: number[] = [];
		for(const point of points) {

			let dist = Number.POSITIVE_INFINITY;
			for(const facet of hull) {
				if(facet.plane[3] < 0) {

					for(const v of vertices) {
						const v1 = facet.verts[v[0]];
						const v2 = facet.verts[v[1]];
						const v3 = facet.verts[v[2]];
						// Test if closest triangle
						const d = this.closestPointTriangle(point,
															points[v1],
															points[v2],
															points[v3]);
						if(d !== -1 && d < dist) dist = d;
					}
				}
			}
			distances.push(dist);
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
			};
			case 4: return {
				dimension: 4,
				x: this.x,
				y: this.y,
				z: this.z,
				e: this.e,
			};
		}
		return {error: `Invalid dimension ${this.dimension} for 3D view`};
	}
}
