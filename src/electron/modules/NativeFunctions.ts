/**
 * Interface to the native functions defined in cpp/native.cpp
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-10-24
 */

/**
 * Type of the native code output
 * @notExported
 */
interface FindAndApplySymmetriesOutput {
	/** Computed space group */
	spaceGroup: string;
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
 * Types of the native module exported functions
 * @notExported
 */
interface NativeModule {
	findAndApplySymmetries: (basis: Float64Array, spaceGroup: string, atomsZ: Int32Array,
							 fractionalCoordinates: Float64Array, applyInputSymmetries: boolean,
							 enableFindSymmetries: boolean, standardizeCell: boolean,
							 standardizeOnly: boolean, createPrimitiveCell: boolean,
							 symprecStandardize: number, symprecDataset: number) => FindAndApplySymmetriesOutput;

	convertSpaceGroupNumber: (spaceGroupNumber: number, variation: number) => ConvertSpaceGroupNumberOutput;
}

import {createRequire} from "node:module";
const rq = createRequire(import.meta.url);
const addon = rq("../build/Release/native") as NativeModule;

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
 * @returns The new cell and atoms positions
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
 * Convert space group number and variation from a CEL format file into the corresponding code
 *
 * @param spaceGroupNumber - Space group number
 * @param variation - Space group variation
 * @returns The converted space group and the conversion status
 */
export const convertSpaceGroupNumber = (spaceGroupNumber: number,
										variation: number): ConvertSpaceGroupNumberOutput =>
	addon.convertSpaceGroupNumber(spaceGroupNumber, variation);
