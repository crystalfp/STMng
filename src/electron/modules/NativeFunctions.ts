/**
 * Interface to the native functions defined in cpp/native.cpp
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-10-24
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
import {createRequire} from "node:module";
const rq = createRequire(import.meta.url);
const addon = rq("../build/Release/native") as NativeModule;

/**
 * Type of the native code output
 * @notExported
 */
interface FindAndApplySymmetriesOutput {
	/** Computed space group */
	spaceGroup: string;
	/** International symmetry symbol */
	intlSymbol: string;
	/** Input space group number */
	sgNumberIn: number;
	/** Computed space group number */
	sgNumberOut: number;
	/** Computed basis */
	basis: Float64Array;
	/** The atom types */
	atomsZ: Int32Array;
	/** The atom fractional coordinates */
	fractionalCoordinates: Float64Array;
	/** If the unit cell has changed */
	noCellChanges: boolean;
	/** Status of the computation */
	status: string;
}

/**
 * Type of the converter from space group number to space group output
 * @notExported
 */
interface ConvertSpaceGroupNumberOutput {

	/** The converted space group */
	spaceGroup: string;

	/** Error type:
	 * - 0: No error
	 * - 1: Conversion has been retried with variation set to 0
	 * - 2: Other errors, the message is in the output string
	 */
	errorNumber: number;
}

/**
 * Result of native module MDS that project points in 2D and 3D
 * @notExported
 */
interface MDS2D3DOutput {
	/** Points projected in 2D: [x0, y0, x1, y1, ...] */
	points2D: number[];
	/** Points projected in 3D: [x0, y0, z0, x1, y1, z1, ...] */
	points3D: number[];
}

/**
 * Result of MDS that project points in 2D and 3D
 * @notExported
 */
interface MDSOutput {
	/** Points projected in 2D: [[x0, y0], [x1, y1], ...] */
	points2D: number[][];
	/** Points projected in 3D: [[x0, y0, z0], [x1, y1, z1], ...] */
	points3D: number[][];
}

/**
 * Types of the native module exported functions
 * @notExported
 */
interface NativeModule {
	findAndApplySymmetries: (basis: Float64Array,
							 spaceGroup: string,
							 atomsZ: Int32Array,
							 fractionalCoordinates: Float64Array,
							 applyInputSymmetries: boolean,
							 enableFindSymmetries: boolean,
							 standardizeCell: boolean,
							 standardizeOnly: boolean,
							 createPrimitiveCell: boolean,
							 symprecStandardize: number,
							 symprecDataset: number) => FindAndApplySymmetriesOutput;

	convertSpaceGroupNumber: (spaceGroupNumber: number, variation: number) => ConvertSpaceGroupNumberOutput;

	MDS: (distancesVector: Float64Array, pointsCount: number) => MDS2D3DOutput;
}

/**
 * Find and apply symmetries
 *
 * @param basis - Cell basis vectors
 * @param spaceGroup - Input space group
 * @param atomsZ - List of atom types
 * @param fractionalCoordinates - Atoms fractional coordinates
 * @param applyInputSymmetries - Apply symmetries from input
 * @param enableFindSymmetries - Find symmetries
 * @param standardizeCell - If the cell should be standardized
 * @param standardizeOnly - Don't find symmetries, standardize only the cell
 * @param createPrimitiveCell - Create a primitive cell instead of a conventional one
 * @param symprecStandardize - Tolerance for cell standardization
 * @param symprecDataset - Tolerance for finding symmetries
 * @returns The new cell, atoms positions and symmetry symbols
 */
export const findAndApplySymmetries = (basis: Float64Array,
									   spaceGroup: string,
									   atomsZ: Int32Array,
							 		   fractionalCoordinates: Float64Array,
									   applyInputSymmetries: boolean,
									   enableFindSymmetries: boolean,
									   standardizeCell: boolean,
									   standardizeOnly: boolean,
									   createPrimitiveCell: boolean,
									   symprecStandardize: number,
									   symprecDataset: number): FindAndApplySymmetriesOutput =>
	addon.findAndApplySymmetries(basis,
								 spaceGroup,
								 atomsZ,
								 fractionalCoordinates,
								 applyInputSymmetries,
								 enableFindSymmetries,
								 standardizeCell,
								 standardizeOnly,
								 createPrimitiveCell,
								 symprecStandardize,
								 symprecDataset);

/**
 * Convert space group number and variation from a Quantum Espresso
 * format file into the corresponding code
 *
 * @param spaceGroupNumber - Space group number
 * @param variation - Space group variation
 * @returns The converted space group and the conversion status
 */
export const convertSpaceGroupNumber = (spaceGroupNumber: number,
										variation: number): ConvertSpaceGroupNumberOutput =>
	addon.convertSpaceGroupNumber(spaceGroupNumber, variation);

/**
 * Compute Multidimensional Scaling (MDS)
 *
 * @param distancesVector - Distances vector (upper triangular of NxN symmetrical distances matrix)
 * @param pointsCount - Number of points (N), that is, the side of the distance matrix
 * @returns Arrays of points coordinates in the 2D and 3D output space
 */
export const MDS = (distancesVector: number[],
					pointsCount: number): MDSOutput => {

	const distances = new Float64Array(distancesVector);

	// The routine computes the multidimensional scaling
	// The points coordinates are also normalized between 0 and 1
	const {points2D, points3D} = addon.MDS(distances, pointsCount);

	// Map the 2D and 3D outputs
	const mappedPoints2D = Array<number[]>(pointsCount);
	const mappedPoints3D = Array<number[]>(pointsCount);
	for(let i=0, i2=0, i3=0; i < pointsCount; ++i, i2 += 2, i3 += 3) {

		mappedPoints2D[i] = Array<number>(2);
		mappedPoints2D[i][0] = points2D[i2];
		mappedPoints2D[i][1] = points2D[i2+1];

		mappedPoints3D[i] = Array<number>(3);
		mappedPoints3D[i][0] = points3D[i3];
		mappedPoints3D[i][1] = points3D[i3+1];
		mappedPoints3D[i][2] = points3D[i3+2];
	}

	return {points2D: mappedPoints2D, points3D: mappedPoints3D};
};
