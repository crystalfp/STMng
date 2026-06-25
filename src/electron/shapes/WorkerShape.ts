/**
 * Worker interface for the routine to parallelize in crystal shape
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-06-16
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import workerpool from "workerpool";
import {computePlaneEnergy} from "./ComputePlaneEnergy";

/** The results returned to the caller */
export interface WorkerResults {

	/** Plane index */
	index: number;

	/** Plane energy */
	energy: number;
}

/**
 * Worker routine for the plane computation for the crystal shape computation
 *
 * @param mH - H index of the plane
 * @param mK - K index of the plane
 * @param mL - L index of the plane
 * @param planeIndex - Index of the corresponding plane
 * @param fractionalCoordinates - Fractional coordinates of the atoms
 * @param basis - Unit cell basis vectors
 * @param norms - ?
 * @param radii - Atoms covalent radii
 * @param electrons - Number of electrons for each atom
 * @param goodBonds - ?
 * @param extraEnergy - ?
 * @param inputCellT - Transposed cell basis vectors
 * @returns Plane index and energy for the plane
 */
const worker = (mH: number,
				mK: number,
				mL: number,
				planeIndex: number,
				fractionalCoordinates: Float64Array,
				basis: Float64Array,
				norms: Float64Array,
				radii: Float64Array,
				electrons: Int32Array,
				goodBonds: number,
				extraEnergy: number,
				inputCellT: Float64Array
			): WorkerResults => {

	// Convert the values
	const transE: number[][] = [];
	for(let i=0, i3=0; i < 3; ++i, i3+=3) {

		transE.push([
			basis[i3],
			basis[i3+1],
			basis[i3+2]
		]);
	}
	const inputCellTE: number[][] = [];
	for(let i=0, i3=0; i < 3; ++i, i3+=3) {

		inputCellTE.push([
			inputCellT[i3],
			inputCellT[i3+1],
			inputCellT[i3+2]
		]);
	}

	// NOTE Don't know why this contortion is needed, but this works
	/* eslint-disable @typescript-eslint/no-for-in-array */
	const normsE: number[] = [];
	for(const v in norms) normsE.push(norms[v]);
	const radiiE: number[] = [];
	for(const v in radii) radiiE.push(radii[v]);
	const electronsE: number[] = [];
	for(const v in electrons) electronsE.push(electrons[v]);
	/* eslint-enable @typescript-eslint/no-for-in-array */

	const natoms = radiiE.length;
	const cell: number[][] = [];
	for(let i=0, i3=0; i < natoms; ++i, i3+=3) {

		cell.push([
			fractionalCoordinates[i3],
			fractionalCoordinates[i3+1],
			fractionalCoordinates[i3+2]
		]);
	}

	const minEnergy = computePlaneEnergy(mH, mK, mL,
										 cell,
										 transE,
										 normsE,
										 radiiE,
										 electronsE,
										 goodBonds,
										 extraEnergy,
										 inputCellTE);

	return {index: planeIndex, energy: minEnergy};
};

/** Register the worker routine */
workerpool.worker({planeEnergy: worker});
