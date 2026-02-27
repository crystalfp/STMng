/**
 * Compute an isosurface of the volumetric data.
 * @remarks Code adapted from https://kitware.github.io/vtk-js/api/Filters_General_ImageMarchingCubes.html
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
/* eslint-disable @stylistic/computed-property-spacing */
import {getCase, getEdge} from "./IsosurfaceTables";
import type {PositionType, BasisType} from "@/types";

/** Compute an isosurface of the volumetric data */
export class IsosurfaceCore {

	private readonly voxelScalars: number[] = [];
	private readonly voxelPts: number[] = [];
	private readonly voxelGradients: number[] = [];
	private readonly cellSides: BasisType;
	private readonly cellLengths: PositionType;
	private vertexIndex = 0;
	private readonly dims0x1;

	// Results
	private readonly faceIndices: number[] = [];
	private readonly faceVertices: number[] = [];
	private readonly vertexNormals: number[] = [];

	private readonly dims: PositionType;
	private readonly origin: PositionType;
	private readonly values: number[];

	/**
	 * Initialize the isosurface computation
	 *
	 * @param dims - Dimensions of the volumetric data
	 * @param basis - The basis matrix
	 * @param origin - Unit cell origin
	 * @param values - Volumetric data
	 */
	constructor(dims: PositionType, basis: BasisType, origin: PositionType, values: number[]) {

		this.dims = dims;
		this.origin = origin;
		this.values = values;

		// A point will be added in each direction to accomodate periodic cell boundaries
		this.cellSides = [
			basis[0] / dims[0],
			basis[1] / dims[0],
			basis[2] / dims[0],
			basis[3] / dims[1],
			basis[4] / dims[1],
			basis[5] / dims[1],
			basis[6] / dims[2],
			basis[7] / dims[2],
			basis[8] / dims[2],
		];

		this.cellLengths = [
			Math.hypot(this.cellSides[0], this.cellSides[1], this.cellSides[2]),
			Math.hypot(this.cellSides[3], this.cellSides[4], this.cellSides[5]),
			Math.hypot(this.cellSides[6], this.cellSides[7], this.cellSides[8]),
		];

		this.dims0x1 = this.dims[0]*this.dims[1];
	}

	/**
	 * Compute the isosurface
	 *
	 * @param isoValue - The value at which the isosurface should be computed
	 */
	computeIsosurface(isoValue: number): void {

		// Reinitialize variables
		this.faceIndices.length = 0;
		this.faceVertices.length = 0;
		this.vertexNormals.length = 0;
		this.voxelScalars.length = 0;
		this.voxelPts.length = 0;
		this.voxelGradients.length = 0;
		this.vertexIndex = 0;

		// For each voxel
		const d2 = this.dims[2];
		const d1 = this.dims[1];
		const d0 = this.dims[0];
		for(let k = 0; k < d2; ++k) {
			for(let j = 0; j < d1; ++j) {
				for(let i = 0; i < d0; ++i) {

					this.produceTriangles(i, j, k, isoValue);
				}
			}
		}
	}

	/**
	 * Compute the triangles inside a voxel
	 *
	 * @param i - Fast index of the origin of the voxel
	 * @param j - Intermediate index of the origin of the voxel
	 * @param k - Slow index of the origin of the voxel
	 * @param isoValue - Value at which the triangles should be computed
	 */
	private produceTriangles(i: number, j: number, k: number, isoValue: number): void {

		// Get vertices values
		this.getVoxelScalars(i, j, k);

		// Get kind of voxel
		const CASE_MASK = [1, 2, 4, 8, 16, 32, 64, 128];
		const VERT_MAP = [0, 1, 3, 2, 4, 5, 7, 6];
		let index = 0;
		for(let idx = 0; idx < 8; idx++) {
			if(this.voxelScalars[VERT_MAP[idx]] >= isoValue) {
				index |= CASE_MASK[idx];
			}
		}

		// Get the kind of triangles inside the voxel
		const voxelTris = getCase(index);
		if(voxelTris[0] < 0) return; // Don't get the voxel coordinates, nothing to do

		// Get the coordinates of the voxel vertices
		this.getVoxelPoints(i, j, k);

		// Compute surface normals
		this.getVoxelGradients(i, j, k);

		// For each edge that contains a vertice of the triangle
    	for(let idx = 0; voxelTris[idx] >= 0; idx += 3) {

      		for(let eid = 0; eid < 3; eid++) {

        		const edgeVerts = getEdge(voxelTris[idx + eid]);

				// Interpolate the triangles vertices coordinates
				const t =
					(isoValue - this.voxelScalars[edgeVerts[0]]) /
					(this.voxelScalars[edgeVerts[1]] - this.voxelScalars[edgeVerts[0]]);

				const x0 = this.voxelPts.slice(edgeVerts[0] * 3, (edgeVerts[0] + 1) * 3);
				const x1 = this.voxelPts.slice(edgeVerts[1] * 3, (edgeVerts[1] + 1) * 3);
				this.faceVertices.push(
					x0[0] + t * (x1[0] - x0[0]),
					x0[1] + t * (x1[1] - x0[1]),
					x0[2] + t * (x1[2] - x0[2])
				);
				this.faceIndices.push(this.vertexIndex++);

				// Interpolate the normals
				const n0 = this.voxelGradients.slice(edgeVerts[0] * 3, (edgeVerts[0] + 1) * 3);
            	const n1 = this.voxelGradients.slice(edgeVerts[1] * 3, (edgeVerts[1] + 1) * 3);
				const nn = [
					n0[0] + t * (n1[0] - n0[0]),
					n0[1] + t * (n1[1] - n0[1]),
					n0[2] + t * (n1[2] - n0[2])
				];
				const len = Math.hypot(nn[0], nn[1], nn[2]);
            	this.vertexNormals.push(nn[0]/len, nn[1]/len, nn[2]/len);
        	}
      	}
	}

	/**
	 * Get the values at the corners of the voxel
	 *
	 * @param i - Fast index of the origin of the voxel
	 * @param j - Intermediate index of the origin of the voxel
	 * @param k - Slow index of the origin of the voxel
	 */
	private getVoxelScalars(i: number, j: number, k: number): void {

		const ids = Array<number>(8).fill(0);

		// First get the indices for the voxel
		// (i,i+1),(j,j+1),(k,k+1) - i varies fastest; then j; then k
		// Wrap indices around
		const kPart = k * this.dims0x1;
		const kPlus1Part = k >= this.dims[2]-1 ? 0 : ((k+1) * this.dims0x1);
		const jPart = j * this.dims[0];
		const jPlus1Part = j >= this.dims[1]-1 ? 0 : ((j+1) * this.dims[0]);
		const iPlus1 = i >= this.dims[0]-1 ? 0 : i+1;
		ids[0] = kPart + jPart + i; 				// i,   j,   k
		ids[1] = kPart + jPart + iPlus1;			// i+1, j,   k
		ids[2] = kPart + jPlus1Part + i;			// i,   j+1, k
		ids[3] = kPart + jPlus1Part + iPlus1;		// i+1, j+1, k
		ids[4] = kPlus1Part + jPart + i; 			// i,   j,   k+1
		ids[5] = kPlus1Part + jPart + iPlus1; 		// i+1, j,   k+1
		ids[6] = kPlus1Part + jPlus1Part + i;		// i,   j+1, k+1
		ids[7] = kPlus1Part + jPlus1Part + iPlus1;	// i+1, j+1, k+1

		// Now retrieve the scalars
		for(let ii = 0; ii < 8; ++ii) {
			this.voxelScalars[ii] = this.values[ids[ii]];
		}
	}

	/**
	 * Retrieve the voxel coordinates
	 *
	 * @param i - Fast index of the origin of the voxel
	 * @param j - Intermediate index of the origin of the voxel
	 * @param k - Slow index of the origin of the voxel
	 */
	private getVoxelPoints(i: number, j: number, k: number): void {

		// (i,i+1),(j,j+1),(k,k+1) - i varies fastest; then j; then k
		this.voxelPts[0] = this.origin[0]+i*this.cellSides[0]+j*this.cellSides[3]+k*this.cellSides[6]; // 0
		this.voxelPts[1] = this.origin[1]+i*this.cellSides[1]+j*this.cellSides[4]+k*this.cellSides[7];
		this.voxelPts[2] = this.origin[2]+i*this.cellSides[2]+j*this.cellSides[5]+k*this.cellSides[8];

		this.voxelPts[3] = this.voxelPts[0] + this.cellSides[0]; // 1
		this.voxelPts[4] = this.voxelPts[1] + this.cellSides[1];
		this.voxelPts[5] = this.voxelPts[2] + this.cellSides[2];

		this.voxelPts[6] = this.voxelPts[0] + this.cellSides[3]; // 2
		this.voxelPts[7] = this.voxelPts[1] + this.cellSides[4];
		this.voxelPts[8] = this.voxelPts[2] + this.cellSides[5];

		this.voxelPts[9]  = this.voxelPts[3] + this.cellSides[3]; // 3
		this.voxelPts[10] = this.voxelPts[4] + this.cellSides[4];
		this.voxelPts[11] = this.voxelPts[5] + this.cellSides[5];

		this.voxelPts[12] = this.voxelPts[0] + this.cellSides[6]; // 4
		this.voxelPts[13] = this.voxelPts[1] + this.cellSides[7];
		this.voxelPts[14] = this.voxelPts[2] + this.cellSides[8];

		this.voxelPts[15] = this.voxelPts[3] + this.cellSides[6]; // 5
		this.voxelPts[16] = this.voxelPts[4] + this.cellSides[7];
		this.voxelPts[17] = this.voxelPts[5] + this.cellSides[8];

		this.voxelPts[18] = this.voxelPts[6] + this.cellSides[6]; // 6
		this.voxelPts[19] = this.voxelPts[7] + this.cellSides[7];
		this.voxelPts[20] = this.voxelPts[8] + this.cellSides[8];

		this.voxelPts[21] = this.voxelPts[9]  + this.cellSides[6]; // 7
		this.voxelPts[22] = this.voxelPts[10] + this.cellSides[7];
		this.voxelPts[23] = this.voxelPts[11] + this.cellSides[8];
	}

	/**
	 * Compute point gradient
	 *
	 * @param i - Fast index of the voxel vertex
	 * @param j - Intermediate index of the voxel vertex
	 * @param k - Slow index of the voxel vertex
	 * @param start - Index of the first element of voxelGradients where to put computed gradient
	 */
  	private getPointGradient(i: number, j: number, k: number, start: number): void {

		let sp;	// Next point (s-plus)
    	let sm;	// Previous point (s-minus)
		let side;

		// x-direction
		side = (j >= this.dims[1]-1 ? 0 : (j * this.dims[0])) +
			   (k >= this.dims[2]-1 ? 0 : (k * this.dims0x1));
		switch(i) {
			case 0:
				sp = this.values[1     + side];
				sm = this.values[        side];
				this.voxelGradients[start] = (sm - sp) / this.cellLengths[0];
				break;
			case this.dims[0] - 1:
				sp = this.values[        side];
				sm = this.values[i     + side];
				this.voxelGradients[start] = (sm - sp) / this.cellLengths[0];
				break;
			case this.dims[0]:
				sp = this.values[        side];
				sm = this.values[i - 1 + side];
				this.voxelGradients[start] = (sm - sp) / this.cellLengths[0];
				break;
			default:
				sp = this.values[i + 1 + side];
				sm = this.values[i - 1 + side];
				this.voxelGradients[start] = (sm - sp) / (2*this.cellLengths[0]);
				break;
		}

    	// y-direction
		side = (i >= this.dims[0]-1 ? 0 : i) +
			   (k >= this.dims[2]-1 ? 0 : (k * this.dims0x1));
		switch(j) {
			case 0:
				sp = this.values[          this.dims[0] + side];
				sm = this.values[                         side];
				this.voxelGradients[start+1] = (sm - sp) / this.cellLengths[1];
				break;
			case this.dims[1] - 1:
				sp = this.values[                         side];
				sm = this.values[      j * this.dims[0] + side];
				this.voxelGradients[start+1] = (sm - sp) / this.cellLengths[1];
				break;
			case this.dims[1]:
				sp = this.values[                         side];
				sm = this.values[  (j-1) * this.dims[0] + side];
				this.voxelGradients[start+1] = (sm - sp) / this.cellLengths[1];
				break;
			default:
				sp = this.values[(j + 1) * this.dims[0] + side];
				sm = this.values[(j - 1) * this.dims[0] + side];
				this.voxelGradients[start+1] = (sm - sp) / (2*this.cellLengths[1]);
				break;
		}

		// z-direction
		side = (i >= this.dims[0]-1 ? 0 : i) +
			   (j >= this.dims[1]-1 ? 0 : (j * this.dims[0]));
		switch(k) {
			case 0:
				sp = this.values[side + this.dims0x1];
				sm = this.values[side               ];
				this.voxelGradients[start+2] = (sm - sp) / this.cellLengths[2];
				break;
			case this.dims[2] - 1:
				sp = this.values[side                   ];
				sm = this.values[side + k * this.dims0x1];
				this.voxelGradients[start+2] = (sm - sp) / this.cellLengths[2];
				break;
			case this.dims[2]:
				sp = this.values[side                   ];
				sm = this.values[side + (k-1) * this.dims0x1];
				this.voxelGradients[start+2] = (sm - sp) / this.cellLengths[2];
				break;
			default:
				sp = this.values[side + (k + 1) * this.dims0x1];
				sm = this.values[side + (k - 1) * this.dims0x1];
				this.voxelGradients[start+2] = (sm - sp) / (2*this.cellLengths[2]);
				break;
		}
  	}

	/**
	 * Compute voxel gradients
	 *
	 * @param i - Fast index of the voxel origin
	 * @param j - Intermediate index of the voxel origin
	 * @param k - Slow index of the voxel origin
	 */
	getVoxelGradients(i: number, j: number, k: number): void {

		this.getPointGradient(i,     j,     k,      0);
		this.getPointGradient(i + 1, j,     k,      3);
		this.getPointGradient(i,     j + 1, k,      6);
		this.getPointGradient(i + 1, j + 1, k,      9);
		this.getPointGradient(i,     j,     k + 1, 12);
		this.getPointGradient(i + 1, j,     k + 1, 15);
		this.getPointGradient(i,     j + 1, k + 1, 18);
		this.getPointGradient(i + 1, j + 1, k + 1, 21);
	}

	/** Access face indices */
	get indices(): number[] {
		return this.faceIndices;
	}

	/** Access face vertices */
	get vertices(): number[] {
		return this.faceVertices;
	}

	/** Access vertex normals */
	get normals(): number[] {
		return this.vertexNormals;
	}
}
