/**
 * Compute isolines on an orthoslice of the volumetric data.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */

import type {PositionType} from "@/types";

export class Isolines {

	// Edges and vertices numbering from https://en.wikipedia.org/wiki/Marching_squares
	//      2
	//    3---2
	//    |   |
	//  3 |   | 1
	//    |   |
	//    0---1
	//      0
	private readonly verticePairs = [	// Edges intersected
		[],								// 	[],
		[0, 1, 0, 3], 					// 	[0, 3],
		[0, 1, 1, 2], 					// 	[0, 1],
		[1, 2, 0, 3], 					// 	[1, 3],
		[1, 2, 2, 3], 					// 	[1, 2],
		[0, 1, 1, 2, 2, 3, 3, 0],		// 	[0, 1, 2, 3],
		[0, 1, 2, 3],					// 	[0, 2],
		[2, 3, 3, 0],					// 	[2, 3],
		[2, 3, 3, 0],					// 	[2, 3],
		[0, 1, 2, 3],					// 	[0, 2],
		[0, 1, 1, 2, 2, 3, 3, 0],		// 	[0, 3, 1, 2],
		[1, 2, 2, 3],					// 	[1, 2],
		[1, 2, 0, 3],					// 	[1, 3],
		[0, 1, 1, 2],					// 	[0, 1],
		[0, 1, 0, 3],					// 	[0, 3],
		[]								// 	[]
	];
	private isolinesVertices: number[][] = [];

	/**
	 * Initialize the isolines computation
	 *
	 * @param volume - The volumetric data
	 * @param sides - The dimensions of the volumetric data
	 * @param isoValues - The list of isoValues for which the isolines should be computed
	 */
	constructor(private readonly volume: number[],
				private readonly sides: PositionType,
				private readonly isoValues: number[]) {}

	/**
	 * Compute isolines on the orthoslice
	 *
	 * @param sideFast - Fast dimension on the orthoslice
	 * @param sideSlow - Slow dimension on the orthoslice
	 * @param sideFixed - Dimension that stay fixed
	 * @param idxFixed - Index of the fixed slice
	 * @param positions - The points coordinates on the orthoslice
	 */
	computeIsolines(sideFast: number, sideSlow: number, sideFixed: number, idxFixed: number,
				    positions: number[]): void {

		this.isolinesVertices = [];
		const len = this.isoValues.length;
		for(let i=0; i < len; ++i) {

			const isolineVertices = this.computeOneIsoline(sideFast, sideSlow, sideFixed, idxFixed,
														   positions, this.isoValues[i]);

			this.isolinesVertices.push(isolineVertices);
		}
	}

	/**
	 * Compute the isoline for a given value
	 *
	 * @param sideFast - Fast dimension on the orthoslice
	 * @param sideSlow - Slow dimension on the orthoslice
	 * @param sideFixed - Dimension that stay fixed
	 * @param idxFixed - Index of the fixed slice
	 * @param positions - The points coordinates on the orthoslice
	 * @param isoValue - Value for which the isoline should be computed
	 * @returns Coordinates of the isoline points (the isoline is a set of segments)
	 */
	private computeOneIsoline(sideFast: number, sideSlow: number, sideFixed: number, idxFixed: number,
				   			  positions: number[], isoValue: number): number[] {

		// The computed isoline vertices
		const isolineVertices: number[] = [];

		// Move on the orthoslice plane (whose size is (maxFast+1) * (maxSlow+1))
		const maxSlow = this.sides[sideSlow];
		const maxFast = this.sides[sideFast];
		for(let j=0; j < maxSlow; ++j) {
			for(let i=0; i < maxFast; ++i) {

				// Values at the four corners of the cell
				let vv: number[] = [];
				switch(sideFixed) {
					case 0:
						vv = [
							this.getValue(idxFixed, j,   i),
							this.getValue(idxFixed, j,   i+1),
							this.getValue(idxFixed, j+1, i+1),
							this.getValue(idxFixed, j+1, i),
						];
						break;
					case 1:
						vv = [
							this.getValue(j,   idxFixed, i),
							this.getValue(j,   idxFixed, i+1),
							this.getValue(j+1, idxFixed, i+1),
							this.getValue(j+1, idxFixed, i),
						];
						break;
					case 2:
						vv = [
							this.getValue(j,   i,   idxFixed),
							this.getValue(j,   i+1, idxFixed),
							this.getValue(j+1, i+1, idxFixed),
							this.getValue(j+1, i,   idxFixed),
						];
						break;
				}

				// Value of each corner:
				//     8-4
				//     | |
				//     1-2
				// The sum of these values for vertices above the isoValue is the type of the cell
				const type = (vv[0] > isoValue ? 1 : 0) +
							 (vv[1] > isoValue ? 2 : 0) +
							 (vv[2] > isoValue ? 4 : 0) +
							 (vv[3] > isoValue ? 8 : 0);

				// Indices at the four corners of the 2D cell
				const i0 = i  +j    *(maxFast+1);
				const i1 = i+1+j    *(maxFast+1);
				const i2 = i+1+(j+1)*(maxFast+1);
				const i3 = i  +(j+1)*(maxFast+1);

				const iv = [i0, i1, i2, i3];

				const pairs = this.verticePairs[type];
				const len = pairs.length;
				for(let k=0; k < len; k+=2) {

					// Indices of the vertices of the intersected side
					const vertex1 = pairs[k];
					const vertex2 = pairs[k+1];

					// Fraction of side (0-1)
					const fraction = (isoValue - vv[vertex1])/(vv[vertex2]-vv[vertex1]);

					// Indices of the vertice coordinates
					const coords1 = 3*iv[vertex1];
					const coords2 = 3*iv[vertex2];

					// The coordinates of the intersection point
					isolineVertices.push(
						fraction*(positions[coords2]  -positions[coords1])  +positions[coords1],
						fraction*(positions[coords2+1]-positions[coords1+1])+positions[coords1+1],
						fraction*(positions[coords2+2]-positions[coords1+2])+positions[coords1+2]
					);
				}
			}
		}

		return isolineVertices;
	}

	/**
	 * Return a value from the volumetric data
	 *
	 * @param nx - Index along X
	 * @param ny - Index along Y
	 * @param nz - Index along Z
	 * @returns Value in the volumetric data at the given indices
	 */
	private getValue(nx: number, ny: number, nz: number): number {

        if(nx === this.sides[0]) nx = 0;
        if(ny === this.sides[1]) ny = 0;
        if(nz === this.sides[2]) nz = 0;

        return this.volume[nx + (ny + nz*this.sides[1])*this.sides[0]];
	}

	/**
	 * Return isolines for display
	 *
	 * @returns List of coordinates lists for each isoline
	 */
	getIsolinesVertices(): number[][] {
		return this.isolinesVertices;
	}
}
