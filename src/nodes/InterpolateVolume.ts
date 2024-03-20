/**
 * Interpolate volume data by inserting intermediate points between input points
 *
 * @packageDocumentation
 */
import {sb, type UiParams} from "@/services/Switchboard";
import type {Structure, Volume, PositionType} from "@/types";
import {M} from "@/services/InterpolationTable";

export class InterpolateVolume {

	private interpolateVolume = false;
	private pointsToAdd = 1;
	private structure: Structure | undefined;

	/**
	 * Create the node
	 *
	 * @param id - ID of the Interpolate Volume node
	 */
	constructor(private readonly id: string) {

		sb.getUiParams(this.id, (params: UiParams) => {
			this.interpolateVolume = params.interpolateVolume as boolean ?? false;
    		this.pointsToAdd = params.pointsToAdd as number ?? 1;

			this.computeInterpolation();
		});

		sb.getData(this.id, (data: unknown) => {

			this.structure = data as Structure;
			this.computeInterpolation();
		});
	}

	/**
	 * Check if the isosurfaces should be created and then create them
	 */
	private computeInterpolation(): void {

		// No data in input, empty structure output
		if(!this.structure?.volume) {
			this.outputEmptyStructure();
			return;
		}

		const {volume, crystal, atoms, bonds, look} = this.structure;

		// If no volumetric data or no unit cell return the input structure
		if(!this.interpolateVolume ||
		   volume.length === 0 ||
		   crystal.basis.every((value) => value === 0)) {
			sb.setData(this.id, this.structure);
			return;
		}

		// Prepare the output structure
		const out: Structure = {
			crystal,
			atoms,
			bonds,
			look,
			volume: []
		};

		// Interpolate each dataset
		for(const dataset of volume) {
			out.volume.push(this.interpolate(dataset));
		}

		// Output the result
		sb.setData(this.id, out);
	}

	/**
	 * Do the interpolation
	 *
	 * @param volume - The volumetric data to be interpolated
	 * @returns The interpolated volumetric data
	 */
	private interpolate(volume: Volume): Volume {

		// Cache some important values
		const sx = volume.sides[0];
		const sy = volume.sides[1];
		const sz = volume.sides[2];
		const pa = this.pointsToAdd;

		// Check at least 4 points in each direction and points to add > 0
		if(sx < 4 || sy < 4 || sz < 4 || pa < 1) {
			return {sides: volume.sides, values: volume.values};
		}

		// Compute output dimensions
		const sxo = sx + (sx - 1) * pa;
		const syo = sy + (sy - 1) * pa;
		const szo = sz + (sz - 1) * pa;
		const outDims: PositionType = [sxo, syo, szo];

		const outValues = Array(sxo*syo*szo).fill(0) as number[];

		// Copy the already known nodes
		for(let k=0; k < sz; ++k) {
			for(let j=0; j < sy; ++j) {
				for(let i=0; i < sx; ++i) {
					outValues[(k*(pa+1)*syo+j*(pa+1))*sxo+i*(pa+1)] = volume.values[(k*sy+j)*sx+i];
				}
			}
		}

		// Compute the other points
		for(let k=0; k < sz-1; ++k) {
			for(let j=0; j < sy-1; ++j) {
				for(let i=0; i < sx-1; ++i) {

					// Decide from where the matrix should be computed
					const oi = (i > sx-4) ? sx-4 : ((i < 2) ? 0 : i-1);
					const oj = (j > sy-4) ? sy-4 : ((j < 2) ? 0 : j-1);
					const ok = (k > sz-4) ? sz-4 : ((k < 2) ? 0 : k-1);

					// Compute matrix
					const c = this.computeMatrix(oi, oj, ok, volume.values, sx, sy);

					// Cover the border
					const bi = (i === (sx-2)) ? 1 : 0;
					const bj = (j === (sy-2)) ? 1 : 0;
					const bk = (k === (sz-2)) ? 1 : 0;

					// Add the intermediate points
					for(let kk=0; kk <= pa+bk; ++kk) {
						const fkk = kk * 1/(pa+1) + k - ok;
						for(let jj=0; jj <= pa+bj; ++jj) {
							const fjj = jj * 1/(pa+1) + j - oj;
							for(let ii=0; ii <= pa+bi; ++ii) {

								if(ii===0 && jj===0 && (kk===0 || kk===(pa+1))) continue;
								if(ii===0 && jj===(pa+1) && (kk===0 || kk===(pa+1))) continue;
								if(ii===(pa+1) && jj===(pa+1) && (kk===0 || kk===(pa+1))) continue;
								if(ii===(pa+1) && jj===0 && (kk===0 || kk===(pa+1))) continue;

								const fii = ii * 1/(pa+1) + i - oi;

								outValues[((k*(pa+1)+kk)*syo+j*(pa+1)+jj)*sxo+i*(pa+1)+ii] =
																				this.computePoint(fii, fjj, fkk, c);
							}
						}
					}
				}
			}
		}

		return {sides: outDims, values: outValues};
	}

	/**
	 * Compute the interpolation matrix
	 *
	 * @param oi - Cell origin x
	 * @param oj - Cell origin y
	 * @param ok - Cell origin z
	 * @param volume - Volumetric data
	 * @param dx - X dimension of the input data
	 * @param dy - Y dimension of the input data
	 * @returns The interpolation matrix
	 */
	private computeMatrix(oi: number, oj: number, ok: number, volume: number[], dx: number, dy: number): number[] {

		// ijk
		const vv = [];
		for(let k=0; k < 4; ++k) {
			for(let j=0; j < 4; ++j) {
				for(let i=0; i < 4; ++i) {
					vv.push(volume[(k+ok)*dx*dy+(j+oj)*dx+(i+oi)]);
				}
			}
		}

		// Compute Minv * V = C
		const cv = [];
		for(let row=0; row < 64; ++row) {
			let ctmp = 0;
			for(let col=0; col < 64; ++col) {
				ctmp += M[row][col] * vv[col];
			}

			cv.push(ctmp);
		}

		// Reorder the matrix
		let nn = 0;
		const c = Array(64).fill(0) as number[];
		for(let k=0; k < 4; ++k) {
			for(let j=0; j < 4; ++j) {
				for(let i=0; i < 4; ++i) {
					// c[i][j][k] = cv[n++];
					c[i*16+j*4+k] = cv[nn++];
				}
			}
		}
		return c;
	}

	/**
	 * Compute the interpolated data point
	 *
	 * @param x - Coordinates of the point to compute
	 * @param y - Coordinates of the point to compute
	 * @param z - Coordinates of the point to compute
	 * @param c - Interpolation matrix
	 * @returns - The point value
	 */
	private computePoint(x: number, y: number, z: number, c: number[]): number {

		let vv = 0;

		const xp = [
			1,
			x,
			x*x,
			x*x*x,
		];
		const yp = [
			1,
			y,
			y*y,
			y*y*y,
		];
		const zp = [
			1,
			z,
			z*z,
			z*z*z,
		];

		// c[i][j][k] -> c[i*16+j*4+k]
		for(let k=0; k < 4; ++k) {
			for(let j=0; j < 4; ++j) {
				for(let i=0; i < 4; ++i) {
					vv += c[i*16+j*4+k]*xp[i]*yp[j]*zp[k];
				}
			}
		}
		return vv;
	}

	// > Output an empty structure
	/**
	 * Output an empty structure
	 */
	private outputEmptyStructure(): void {

		sb.setData(this.id, {
			crystal: {
				basis: [0, 0, 0, 0, 0, 0, 0, 0, 0],
				origin: [0, 0, 0],
				spaceGroup: ""
			},
			atoms: [],
			bonds: [],
			look: {},
			volume: []
		});
	}

	/**
	 * Save the node status
	 *
	 * @returns The JSON formatted status to be saved
	 */
	saveStatus(): string {

		const statusToSave = {
			interpolateVolume: this.interpolateVolume,
			pointsToAdd: this.pointsToAdd,
		};
		return `"${this.id}": ${JSON.stringify(statusToSave)}`;
	}
}
