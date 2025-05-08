/**
 * Adapter to the Structure type to provide all the functions needed for X-Ray factors computation
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-10-26
 */
import {basisToLengthAngles, invertBasis} from "./Helpers";
import type {BasisType, LengthsAnglesType, PositionType, Structure} from "@/types";

/**
 * Adapter to the Structure type to provide all the functions needed for X-Ray factors computation
 */
export class Lattice {

	private readonly lengthsAngles: LengthsAnglesType;
	private readonly inverseBasis: BasisType;
	private readonly structure: Structure;

	/**
	 * Convert a structure into a lattice
	 *
	 * @param structure - Structure to be loaded in a lattice
	 */
	constructor(structure: Structure) {

		this.structure = structure;
		const {crystal} = structure;
		const {basis} = crystal;

		// Change basis into sides lengths and angles
		this.lengthsAngles = basisToLengthAngles(basis);

		// Compute the inverse basis matrix
		this.inverseBasis = invertBasis(basis);
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

		const out = Array<number>(9).fill(0);
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
