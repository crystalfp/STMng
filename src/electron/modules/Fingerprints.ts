/**
 * Compute the fingerprint of a series of structures.
 *
 * @packageDocumentation
 *
 * @author Mario Valle {@link "mvalle@ikmail.com"}
 */
import {ipcMain} from "electron";
import fs from "node:fs";
import type {Structure} from "../../types";

const energyPerStructure: number[] = [];
let minEnergy = Number.POSITIVE_INFINITY;
let thresholdEnergy = Number.POSITIVE_INFINITY;
const structures: Structure[] = [];
let filteringEnabled = false;

/**
 * Filter the list of accumulated structure by energy
 *
 * @returns The number of selected structures or -1 if the energies values are less than the number of
 *          accumulated structures
 */
const filterOnEnergy = (): number => {

	if(filteringEnabled) {

		const len = structures.length;
		if(energyPerStructure.length < len) return -1;

		let countSelected = 0;
		for(let i=0; i < len; ++i) if(energyPerStructure[i] <= thresholdEnergy) ++countSelected;

		return countSelected;
	}
	return structures.length;
};

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
		}
		catch(error) {
			return {error: (error as Error).message, payload: "Error"};
		}

		return {payload: "Success!"};
	});

	ipcMain.handle("CFP:FILTER-PARAMS", (_event, enabled: boolean,
										 threshold: number, fromMinimum: boolean) => {

		const returnValues = {
			effectiveEnergy: threshold,
			selected: structures.length
		};

		filteringEnabled = enabled;

		// If energy file not loaded
		if(enabled && minEnergy === Number.POSITIVE_INFINITY) {
			return {error: "Energy file not loaded", payload: JSON.stringify(returnValues)};
		}

		thresholdEnergy = fromMinimum ? minEnergy+threshold : threshold;

		const countSelected = filterOnEnergy();
		if(countSelected < 0) {
			return {error: "The energies are less than structures", payload: JSON.stringify(returnValues)};
		}

		returnValues.effectiveEnergy = thresholdEnergy;
		returnValues.selected = countSelected;

		return {payload: JSON.stringify(returnValues)};
	});

	ipcMain.handle("CFP:ACCUMULATE", (_event, encodedStructure: string, reset: boolean) => {

		const counts = {
			total: 0,
			filtered: 0
		};

		if(reset) {
			structures.length = 0;
			return {payload: JSON.stringify(counts)};
		}
		structures.push(JSON.parse(encodedStructure) as Structure);

		counts.total = structures.length;

		// Do filtering
		const countSelected = filterOnEnergy();
		if(countSelected < 0) {
			return {error: "The energies are less than structures", payload: JSON.stringify(counts)};
		}
		counts.filtered = countSelected;

		return {payload: JSON.stringify(counts)};
	});

	ipcMain.handle("CFP:COMPUTE", (_event, forceCutoff: boolean, cutoffDistance: number,
									selectedMethod: number, binSize: number, peakWidth: number) => {

		// Check structures filtered
		const countSelected = filterOnEnergy();
		if(countSelected <= 0) {
			return {error: "No structure selected", payload: "0"};
		}

		// Do computation
		console.log(forceCutoff, cutoffDistance, selectedMethod, binSize, peakWidth); // TBD
		const resultDimensionality = 200;

		// Success!
		return {payload: resultDimensionality.toString()};
	});
};
