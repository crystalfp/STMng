/**
 * Write atomic structure file.
 *
 * @packageDocumentation
 */
import {ipcMain} from "electron";
// import log from "electron-log";
import fs from "node:fs";

const energyPerStructure: number[] = [];
let minEnergy = Number.POSITIVE_INFINITY;

/**
 * Setup channels for fingerprints computation
 */
export const setupChannelFingerprints = (): void => {

	ipcMain.handle("CFP:LOAD-ENERGIES", (_event, path: string) => {

		try {
			let energiesRaw = fs.readFileSync(path, "utf8");
			energiesRaw = energiesRaw.trim().replaceAll("\r\n", "\n");
			if(energiesRaw === "") return {error: "Empty energy file", payload: "Error"};
			const energiesRawSplit = energiesRaw.split("\n");
			for(const energy of energiesRawSplit) {
				const value = Number.parseFloat(energy);
				if(Number.isNaN(value)) return {error: "Found one invalid energy value", payload: "Error"};
				if(value < minEnergy) minEnergy = value;
				energyPerStructure.push(value);
			}
			console.log("Energies:", energyPerStructure.length, minEnergy); // TBD
		}
		catch(error: unknown) {
			return {error: (error as Error).message, payload: "Error"};
		}

		return {payload: "Success!"};
	});
};
