/**
 * Compute symmetries on the main process.
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";

interface NativeModule {
	computeSymmetries: (spaceGroup: string, fractionalCoords: Float64Array) => string;
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
};
