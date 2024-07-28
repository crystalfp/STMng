/**
 * Compute an isosurface of the volumetric data.
 * @remarks Code adapted from https://kitware.github.io/vtk-js/api/Filters_General_ImageMarchingCubes.html
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */

import type {PositionType, BasisType} from "@/types";
import {getCase, getEdge} from "@/services/IsosurfaceTables";

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

	constructor(private readonly dims: PositionType,
				basis: BasisType,
				private readonly origin: PositionType,
			    private readonly values: number[]) {

		this.cellSides = [
			basis[0] / (dims[0]-1),
			basis[1] / (dims[0]-1),
			basis[2] / (dims[0]-1),
			basis[3] / (dims[1]-1),
			basis[4] / (dims[1]-1),
			basis[5] / (dims[1]-1),
			basis[6] / (dims[2]-1),
			basis[7] / (dims[2]-1),
			basis[8] / (dims[2]-1),
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

		// For each voxel
		for(let k = 0; k < this.dims[2] - 1; ++k) {
			for(let j = 0; j < this.dims[1] - 1; ++j) {
				for(let i = 0; i < this.dims[0] - 1; ++i) {

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
				index |= CASE_MASK[idx]; // eslint-disable-line no-bitwise
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

		const ids = Array(8).fill(0) as number[];

		// First get the indices for the voxel
		// (i,i+1),(j,j+1),(k,k+1) - i varies fastest; then j; then k
		ids[0] = k * this.dims[0] * this.dims[1] + j * this.dims[0] + i; // i, j, k
		ids[1] = ids[0] + 1; // i+1, j, k
		ids[2] = ids[0] + this.dims[0]; // i, j+1, k
		ids[3] = ids[2] + 1; // i+1, j+1, k
		ids[4] = ids[0] + this.dims[0] * this.dims[1]; // i, j, k+1
		ids[5] = ids[4] + 1; // i+1, j, k+1
		ids[6] = ids[4] + this.dims[0]; // i, j+1, k+1
		ids[7] = ids[6] + 1; // i+1, j+1, k+1

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
	 * @param g - Computed gradient
	 */
  	private getPointGradient(i: number, j: number, k: number, g: number[]): void {

		let sp;
    	let sm;
		let side;

		// x-direction
		side = j * this.dims[0] + k * this.dims0x1;
		if(i === 0) {
			sp = this.values[i + 1 + side];
			sm = this.values[i     + side];
			g[0] = (sm - sp) / this.cellLengths[0];
		}
		else if(i === this.dims[0] - 1) {
			sp = this.values[i     + side];
			sm = this.values[i - 1 + side];
			g[0] = (sm - sp) / this.cellLengths[0];
		}
		else {
			sp = this.values[i + 1 + side];
			sm = this.values[i - 1 + side];
			g[0] = (0.5 * (sm - sp)) / this.cellLengths[0];
		}

    	// y-direction
		side = i + k * this.dims0x1;
    	if(j === 0) {
			sp = this.values[(j + 1) * this.dims[0] + side];
			sm = this.values[j       * this.dims[0] + side];
			g[1] = (sm - sp) / this.cellLengths[1];
		}
		else if(j === this.dims[1] - 1) {
			sp = this.values[j       * this.dims[0] + side];
			sm = this.values[(j - 1) * this.dims[0] + side];
			g[1] = (sm - sp) / this.cellLengths[1];
		}
		else {
			sp = this.values[(j + 1) * this.dims[0] + side];
			sm = this.values[(j - 1) * this.dims[0] + side];
			g[1] = (0.5 * (sm - sp)) / this.cellLengths[1];
		}

		// z-direction
		side = i + j * this.dims[0];
		if(k === 0) {
			sp = this.values[side + (k + 1) * this.dims0x1];
			sm = this.values[side + k * this.dims0x1];
			g[2] = (sm - sp) / this.cellLengths[2];
		}
		else if(k === this.dims[2] - 1) {
			sp = this.values[side + k * this.dims0x1];
			sm = this.values[side + (k - 1) * this.dims0x1];
			g[2] = (sm - sp) / this.cellLengths[2];
		}
		else {
			sp = this.values[side + (k + 1) * this.dims0x1];
			sm = this.values[side + (k - 1) * this.dims0x1];
			g[2] = (0.5 * (sm - sp)) / this.cellLengths[2];
    	}
  	}

	/**
	 * Compute voxel gradient
	 *
	 * @param i - Fast index of the voxel origin
	 * @param j - Intermediate index of the voxel origin
	 * @param k - Slow index of the voxel origin
	 */
	getVoxelGradients(i: number, j: number, k: number): void {

	    const g = [0, 0, 0];

		this.getPointGradient(i, j, k, g);
		this.voxelGradients[0] = g[0];
		this.voxelGradients[1] = g[1];
		this.voxelGradients[2] = g[2];
		this.getPointGradient(i + 1, j, k, g);
		this.voxelGradients[3] = g[0];
		this.voxelGradients[4] = g[1];
		this.voxelGradients[5] = g[2];
		this.getPointGradient(i, j + 1, k, g);
		this.voxelGradients[6] = g[0];
		this.voxelGradients[7] = g[1];
		this.voxelGradients[8] = g[2];
		this.getPointGradient(i + 1, j + 1, k, g);
		this.voxelGradients[9]  = g[0];
		this.voxelGradients[10] = g[1];
		this.voxelGradients[11] = g[2];
		this.getPointGradient(i, j, k + 1, g);
		this.voxelGradients[12] = g[0];
		this.voxelGradients[13] = g[1];
		this.voxelGradients[14] = g[2];
		this.getPointGradient(i + 1, j, k + 1, g);
		this.voxelGradients[15] = g[0];
		this.voxelGradients[16] = g[1];
		this.voxelGradients[17] = g[2];
		this.getPointGradient(i, j + 1, k + 1, g);
		this.voxelGradients[18] = g[0];
		this.voxelGradients[19] = g[1];
		this.voxelGradients[20] = g[2];
		this.getPointGradient(i + 1, j + 1, k + 1, g);
		this.voxelGradients[21] = g[0];
		this.voxelGradients[22] = g[1];
		this.voxelGradients[23] = g[2];
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
