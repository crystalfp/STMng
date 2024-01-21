/**
 * Setup the channel to visualize application, Chrome, node and electron versions
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";

interface NativeModule {
	hello: () => void;
}

export const setupChannelSymmetries = (): void => {

	/* eslint-disable-next-line @typescript-eslint/no-unsafe-call,
	   @typescript-eslint/no-var-requires, unicorn/prefer-module */
	const addon = require("bindings")("hello") as NativeModule;

	ipcMain.handle("COMPUTE:SYMMETRIES",  (_event, spaceGroup: string, fractionalCoords: number[]) => {

		// TBD Symmetry computation
		const data = new Float32Array(fractionalCoords);
		void data;
		console.log("Native addon:", addon.hello());
		console.log("Received:", spaceGroup, "and", fractionalCoords.length);
		return {payload: JSON.stringify(fractionalCoords)};
	});
};
