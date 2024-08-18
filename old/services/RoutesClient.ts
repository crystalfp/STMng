/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {WindowsParams, Structure} from "../../new/types";
import type {MainResponse} from "@/types";
import {showErrorNotification} from "@/services/ErrorNotification";

/** Global definitions of the interfaces exported by preload.js */
declare global {
	interface Window {
		electron: ElectronAPI;
		api: {
			setTitle: (title: string) => void;
			refreshMenu: () => void;
		};
	}
}

// > Project
/**
 * Receive a loaded project
 *
 * @param callback - Function to call when receiving a new project
 */
export const receiveProject = (callback: (rawProject: string) => void): void => {

    window.electron.ipcRenderer.invoke("PROJECT:GET")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((rawProject: string) => callback(rawProject))
		.catch((error: Error) => showErrorNotification(`Cannot retrieve project first time. ${error.message}`));
    window.electron.ipcRenderer.on("PROJECT:GET-NEXT", (_event, rawProject: string) => callback(rawProject));
};

/**
 * Send the current project to the main process for saving.
 *
 * @param callback - Function that returns the current loaded project to be saved
 */
export const sendProject = (callback: () => string): void => {
	window.electron.ipcRenderer.on("PROJECT:REQUEST", () => {
		window.electron.ipcRenderer.send("PROJECT:ANSWER", callback());
	});
};

// > Generic secondary windows handling
/**
 * Create a secondary window.
 *
 * @param params - Params for the newly created window
 */
export const createWindow = (params: WindowsParams): void => {

	window.electron.ipcRenderer.send("WINDOW:NEW", params);
};

/**
 * Send a string to a specific window
 *
 * @param routerPath - Route path of the receiving window
 * @param data - Data to send to the window
 */
export const sendToWindow = (routerPath: string, data: string): void => {

	window.electron.ipcRenderer.send("WINDOW:SEND", {routerPath, data});
};

// > Fingerprints
/**
 * Read and parse the energy file.
 *
 * @param path - Path of the energy file
 * @returns Operation status
 */
export const loadEnergyFile = (path: string): Promise<MainResponse> => window.electron.ipcRenderer.invoke("CFP:LOAD-ENERGIES", path) as Promise<MainResponse>;

/**
 * Get the parameters for the filter
 *
 * @param enabled - Filtering by energy enabled
 * @param threshold - Energy threshold
 * @param fromMinimum - If the threshold is from minimum energy
 * @returns The threshold energy and the number of structures selected
 */
export const setEnergyFilterParameters = (enabled: boolean, threshold: number, fromMinimum: boolean): Promise<MainResponse> => window.electron.ipcRenderer.invoke("CFP:FILTER-PARAMS",
											  enabled, threshold, fromMinimum) as Promise<MainResponse>;

/**
 * Add another structure to the list of structures for fingerprinting and filtering
 *
 * @param structure - The structure to add to the the list of structures for computing fingerprinting.
 					  If missing the routine reset the accumulator
 * @returns The total and filtered counts
 */
export const accumulateStructure = (structure?: Structure): Promise<MainResponse> => {

	const reset = structure === undefined;
	const encodedStructure = reset ? "" : JSON.stringify(structure);
	return window.electron.ipcRenderer.invoke("CFP:ACCUMULATE",
											  encodedStructure, reset) as Promise<MainResponse>;
};

/**
 * Compute fingerprints
 *
 * @param forceCutoff - If there is a manual distance cutoff
 * @param cutoffDistance - The manual distance cutoff
 * @param selectedMethod - Fingerprint compute method
 * @param binSize - Bin size for the pseudo-diffraction methods
 * @param peakWidth - Peak smearing size
 * @returns - The resulting fingerprints space dimensionality
 */
export const computeFingerprints = (forceCutoff: boolean, cutoffDistance: number,
									selectedMethod: number,
									binSize: number, peakWidth: number): Promise<MainResponse> =>
										window.electron.ipcRenderer.invoke("CFP:COMPUTE",
											forceCutoff, cutoffDistance, selectedMethod,
											binSize, peakWidth) as Promise<MainResponse>;

// > Atomic data
/**
 * Get the atomic data from main to the client
 *
 * @returns JSON encoded table of atom data
 */
export const getAtomData = (): Promise<string> =>
	window.electron.ipcRenderer.invoke("ATOM:GET-ALL") as Promise<string>;
