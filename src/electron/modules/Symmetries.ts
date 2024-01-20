/**
 * Setup the channel to visualize application, Chrome, node and electron versions
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";

export const setupChannelSymmetries = (): void => {

	ipcMain.handle("COMPUTE:SYMMETRIES",  (_event, spaceGroup: string, fractionalCoords: number[]) => {

		// TBD Symmetry computation
		console.log("Received:", spaceGroup, "and", fractionalCoords.length);
		return {payload: JSON.stringify(fractionalCoords)};
	});
};
