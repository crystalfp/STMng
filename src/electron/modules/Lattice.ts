/**
 * Adapter to the Structure type to provide all the functions needed for X-Ray factors computation
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-26
 */
import type {BasisType, PositionType, Structure} from "@/types";
import {basisToLengthAngles} from "./Helpers";

/**
 * Alternative description of the unit cell
 * @notExported
 */
type LengthsAnglesType = [a: number, b: number, c: number, alpha: number, beta: number, gamma: number];

export class Lattice {

	private readonly lengthsAngles: LengthsAnglesType;
	private readonly inverseBasis: BasisType;

	constructor(private readonly structure: Structure) {

		const {crystal} = this.structure;
		const {basis: b} = crystal;

		// Change basis into sides lengths and angles
		this.lengthsAngles = basisToLengthAngles(b) as LengthsAnglesType;

		// Compute the determinant of the matrix
		const det = b[0] * (b[4] * b[8] - b[5] * b[7]) -
					b[1] * (b[3] * b[8] - b[5] * b[6]) +
					b[2] * (b[3] * b[7] - b[4] * b[6]);

		// Check if the determinant is zero, which means the matrix is not invertible
		if(det === 0) throw Error("Basis matrix is not invertible");

		// Compute the inverse basis matrix
		const invDet = 1 / det;
		this.inverseBasis = [
			(b[4] * b[8] - b[5] * b[7]) * invDet,
			(b[2] * b[7] - b[1] * b[8]) * invDet,
			(b[1] * b[5] - b[2] * b[4]) * invDet,
			(b[5] * b[6] - b[3] * b[8]) * invDet,
			(b[0] * b[8] - b[2] * b[6]) * invDet,
			(b[2] * b[3] - b[0] * b[5]) * invDet,
			(b[3] * b[7] - b[4] * b[6]) * invDet,
			(b[1] * b[6] - b[0] * b[7]) * invDet,
			(b[0] * b[4] - b[1] * b[3]) * invDet
		];
	}

	/**
	 * Check if lattice corresponds to an hexagonal lattice
	 *
	 * @param angleTolerance - Angle tolerance
	 * @param lengthTolerance - Length tolerance
	 * @returns Whether lattice corresponds to hexagonal lattice
	 */
	isHexagonal(angleTolerance = 5, lengthTolerance = 0.01): boolean {

		const rightAngles: number[] = [];
		const hexAngles: number[] = [];

		for(let i=3; i < 6; ++i) {
			const delta90 = this.lengthsAngles[i] - 90;
			if(delta90 < angleTolerance && delta90 > -angleTolerance) rightAngles.push(i-3);
			const delta60  = this.lengthsAngles[i] - 60;
			const delta120 = this.lengthsAngles[i] - 120;
			if((delta60 < angleTolerance && delta60 > -angleTolerance) ||
			   (delta120 < angleTolerance && delta120 > -angleTolerance)) hexAngles.push(i-3);
		}

		const deltaLen = this.lengthsAngles[rightAngles[0]] - this.lengthsAngles[rightAngles[1]];

        return (
            rightAngles.length === 2 &&
            hexAngles.length === 1 &&
            (deltaLen < lengthTolerance && deltaLen > -lengthTolerance)
        );
	}

	/**
	 * Return the cell origin
     */
	get origin(): number[] {return this.structure.crystal.origin;}

	/**
	 * Return the lengths of the basis vectors
	 */
	get lengths(): number[] {return this.lengthsAngles.slice(0, 3);}

	/**
	 * Return the basis matrix how it is considered in the python library
	 */
	get matrix(): number[] {

		const out = Array(9).fill(0) as number[];
		for(let row=0; row < 3; ++row) {
			for(let col=0; col < 3; ++col) {
				out[3*col+row] = this.inverseBasis[3*row+col];
			}
		}

		return out;
	}

	/**
	 * Convert cartesian coordinates into corresponding fractional ones
	 *
	 * @param position - Cartesian coordinates
	 * @returns Fractional coordinates
	 */
	toFractionalCoordinates(position: number[]): PositionType {

		const {origin} = this.structure.crystal;

		const cx = position[0] - origin[0];
		const cy = position[1] - origin[1];
		const cz = position[2] - origin[2];

		return [
			cx*this.inverseBasis[0] + cy*this.inverseBasis[3] + cz*this.inverseBasis[6],
			cx*this.inverseBasis[1] + cy*this.inverseBasis[4] + cz*this.inverseBasis[7],
			cx*this.inverseBasis[2] + cy*this.inverseBasis[5] + cz*this.inverseBasis[8]
		];
	}

	/**
	 * Convert fractional coordinates into corresponding cartesian ones
	 *
	 * @param fractional - Fractional coordinates
	 * @returns Cartesian coordinates
	 */
	toCartesianCoodinates(fractional: number[]): PositionType {

		const {basis} = this.structure.crystal;
		const fx = fractional[0];
		const fy = fractional[1];
		const fz = fractional[2];

		return [
			fx*basis[0] + fy*basis[3] + fz*basis[6],
			fx*basis[1] + fy*basis[4] + fz*basis[7],
			fx*basis[2] + fy*basis[5] + fz*basis[8],
		];
	}

	/**
	 * Compute the reciprocal cell vectors lengths
	 *
	 * @returns Lengths of the reciprocal cell vectors
	 */
	reciprocalLatticeLengths(): number[] {

		const {crystal} = this.structure;
		const {basis: b} = crystal;

		const abc = [0, 0, 0];
		for(let row=0; row < 3; ++row) {
			const aa = b[row*3]   * 2 * Math.PI;
			const bb = b[row*3+1] * 2 * Math.PI;
			const cc = b[row*3+2] * 2 * Math.PI;

			abc[row] = Math.hypot(aa, bb, cc);
		}

		return abc;
	}
}
