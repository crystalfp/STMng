/**
 * Compute symmetries on the main process.
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";
import type {ComputeSymmetriesParams} from "@/electron/types";
import {getStructureAppearanceFromZ} from "./ReaderWriterHelpers";

interface NativeModule {
	computeSymmetries: (spaceGroup: string, fractionalCoords: Float64Array) => string;
	findAndApplySymmetries: (basis:  Float64Array, spaceGroup: string, atomsZ: Int8Array,
							 fractionalCoordinates: Float64Array, applyInputSymmetries: boolean,
							 enableFindSymmetries: boolean, standardizeCell: boolean,
							 symprecStandardize: number, symprecDataset: number) => string;
}

/**
 * Setup channel to compute symmetries from main window
 */
export const setupChannelSymmetries = (): void => {

	/* eslint-disable-next-line @typescript-eslint/no-var-requires, unicorn/prefer-module */
	const addon = require("../build/Release/native") as NativeModule;

	ipcMain.handle("COMPUTE:SYMMETRIES", (_event, spaceGroup: string, fractionalCoords: number[]) => {

		const out = addon.computeSymmetries(spaceGroup, new Float64Array(fractionalCoords));
		return {payload: out};
	});
/*
	basis: BasisType;
	spaceGroup: string;
	atomsZ: number[];
	fractionalCoordinates: number[];

	// Operations
	applyInputSymmetries: boolean;
	enableFindSymmetries: boolean;
	standardizeCell: boolean;

	// Tolerances
	symprecStandardize: number;
	symprecDataset: number;
*/
	ipcMain.handle("SYMMETRIES:COMPUTE", (_event, paramsEncoded: string) => {

		const params = JSON.parse(paramsEncoded) as ComputeSymmetriesParams;

		// const basis = new Float64Array(params.basis);
		// const atomsZ = new Int8Array(params.atomsZ);
		// const fractionalCoordinates = new Float64Array(params.fractionalCoordinates);
		// const out = addon.findAndApplySymmetries(basis, params.spaceGroup, atomsZ,
		// 					 fractionalCoordinates, params.applyInputSymmetries,
		// 					 params.enableFindSymmetries, params.standardizeCell,
		// 					 params.symprecStandardize, params.symprecDataset);

		// TBD
		const look = getStructureAppearanceFromZ(params.atomsZ);
		const labels = [];
		for(const atomZ of params.atomsZ) labels.push(look[atomZ].symbol);

		const out = {
			basis: params.basis,
			spaceGroup: params.spaceGroup,
			atomsZ: params.atomsZ,
			labels,
			fractionalCoordinates: params.fractionalCoordinates,
			noCellChanges: false,
			look
		};
		return {payload: JSON.stringify(out)};
	});
};
