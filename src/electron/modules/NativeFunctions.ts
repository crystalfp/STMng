/**
 * Interface to the native functions defined in cpp/native.cpp
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-10-24
 */
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable sonarjs/sonar-max-params, max-params */

/**
 * Type of the native code output
 * @notExported
 */
interface FindAndApplySymmetriesOutput {
	spaceGroup: string;
	basis: Float64Array;
	atomsZ: Int32Array;
	fractionalCoordinates: Float64Array;
	noCellChanges: boolean;
	status: string;
}

/**
 * Type of the converter from space group number to space group output
 * @notExported
 */
interface ConvertSpaceGroupNumberOutput {
	spaceGroup: string;
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
							 standardizeOnly: boolean,
							 symprecStandardize: number, symprecDataset: number) => FindAndApplySymmetriesOutput;

	convertSpaceGroupNumber: (spaceGroupNumber: number, variation: number) => ConvertSpaceGroupNumberOutput;
}

// /* eslint-disable-next-line @typescript-eslint/no-require-imports, unicorn/prefer-module */
// const addon = require("../build/Release/native") as NativeModule;

import {createRequire} from "node:module";
const rq = createRequire(import.meta.url);
const addon = rq("../build/Release/native") as NativeModule;

export const findAndApplySymmetries = (basis: Float64Array,
									   spaceGroup: string,
									   atomsZ: Int32Array,
							 		   fractionalCoordinates: Float64Array,
									   applyInputSymmetries: boolean,
									   enableFindSymmetries: boolean,
									   standardizeCell: boolean,
									   standardizeOnly: boolean,
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
								 symprecStandardize,
								 symprecDataset);

export const convertSpaceGroupNumber = (spaceGroupNumber: number,
										variation: number): ConvertSpaceGroupNumberOutput =>
	addon.convertSpaceGroupNumber(spaceGroupNumber, variation);
