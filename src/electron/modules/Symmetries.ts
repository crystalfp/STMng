/**
 * Compute symmetries on the main process.
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";
import type {ComputeSymmetriesParams} from "@/electron/types";
import {getAtomicSymbol} from "./AtomData";

interface NativeOutput {
	spaceGroup: string;
	basis: Float64Array;
	atomsZ: Int32Array;
	fractionalCoordinates: Float64Array;
	noCellChanges: boolean;
	status: string;
}

interface NativeModule {
	findAndApplySymmetries: (basis: Float64Array, spaceGroup: string, atomsZ: Int32Array,
							 fractionalCoordinates: Float64Array, applyInputSymmetries: boolean,
							 enableFindSymmetries: boolean, standardizeCell: boolean,
							 standardizeOnly: boolean,
							 symprecStandardize: number, symprecDataset: number) => NativeOutput;
}

/**
 * Setup channel to compute symmetries from main window
 */
export const setupChannelSymmetries = (): void => {

	/* eslint-disable-next-line @typescript-eslint/no-var-requires, unicorn/prefer-module */
	const addon = require("../build/Release/native") as NativeModule;

	ipcMain.handle("SYMMETRIES:COMPUTE", (_event, paramsEncoded: string) => {

		// Prepare parameters
		const params = JSON.parse(paramsEncoded) as ComputeSymmetriesParams;

		const basis = new Float64Array(params.basis);
		const natoms = params.atomsZ.length;
		const atomsZ = new Int32Array(natoms);
		for(let i=0; i < natoms; ++i) atomsZ[i] = params.atomsZ[i];
		const fractionalCoordinates = new Float64Array(params.fractionalCoordinates);

		// Do the computation
		const computed = addon.findAndApplySymmetries(basis, params.spaceGroup, atomsZ,
													  fractionalCoordinates, params.applyInputSymmetries,
													  params.enableFindSymmetries, params.standardizeCell,
													  params.standardizeOnly,
													  params.symprecStandardize, params.symprecDataset);

		// Reformat the returned values
		const atomsZOut = [...computed.atomsZ];
		const labels = [];
		for(const atomZ of atomsZOut) labels.push(getAtomicSymbol(atomZ));

		// Return results to the client
		const out = {
			basis: [...computed.basis],
			spaceGroup: computed.spaceGroup,
			atomsZ: atomsZOut,
			labels,
			fractionalCoordinates: [...computed.fractionalCoordinates],
			noCellChanges: computed.noCellChanges,
			status: computed.status
		};
		return {payload: JSON.stringify(out)};
	});
};
