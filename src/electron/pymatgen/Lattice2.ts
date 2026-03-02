/**
 * Adapter to the Structure type to provide all the functions needed
 * for X-Ray factors computation
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-10-26
 *
 * This code is ported from the Python Pymatgen library:
 *
 * Shyue Ping Ong, William Davidson Richards, Anubhav Jain, Geoffroy Hautier,
 * Michael Kocher, Shreyas Cholia, Dan Gunter, Vincent Chevrier, Kristin A.
 * Persson, Gerbrand Ceder. Python Materials Genomics (pymatgen): A Robust,
 * Open-Source Python Library for Materials Analysis. Computational Materials
 * Science, 2013, 68, 314–319. https://doi.org/10.1016/j.commatsci.2012.10.028
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
import {basisToLengthAngles, invertBasis} from "../modules/Helpers";
import type {BasisType, LengthsAnglesType, PositionType, Structure} from "@/types";

/**
 * Adapter to the Structure type to provide all the functions needed for X-Ray factors computation
 */
export class Lattice {

	private readonly lengthsAngles: LengthsAnglesType;
	private readonly inverseBasis: BasisType;
	public readonly origin: number[];
	private readonly basis: BasisType;

	/**
	 * Convert a structure into a lattice
	 *
	 * @param structure - Structure to be loaded in a lattice
	 */
	constructor(structure: Structure) {

		const {crystal} = structure;
		const {basis, origin} = crystal;

		this.origin = [
			origin[0],
			origin[1],
			origin[2]
		];
		this.basis = [
			basis[0],
			basis[1],
			basis[2],
			basis[3],
			basis[4],
			basis[5],
			basis[6],
			basis[7],
			basis[8]
		];

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
	 * Return the basis matrix how it is considered in the python library
	 *
	 * @returns The inverted basis matrix
	 */
	getMatrix(): number[] {

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

		const cx = position[0] - this.origin[0];
		const cy = position[1] - this.origin[1];
		const cz = position[2] - this.origin[2];

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
	toCartesianCoordinates(fractional: number[]): PositionType {

		const [fx, fy, fz] = fractional;
		const {basis} = this;

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

		const abc = [0, 0, 0];
		for(let row=0; row < 3; ++row) {
			const aa = this.basis[row*3]   * 2 * Math.PI;
			const bb = this.basis[row*3+1] * 2 * Math.PI;
			const cc = this.basis[row*3+2] * 2 * Math.PI;

			abc[row] = Math.hypot(aa, bb, cc);
		}

		return abc;
	}
}
