/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 */
import {watchEffect} from "vue";
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {WindowsParams, FindSymmetriesParams, ComputeSymmetriesParams} from "@/electron/types";
import type {MainResponse, Structure} from "@/types";
import {useMessageStore} from "@/stores/messageStore";
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


// > General system functions
/**
 * Verify IPC is up and running.
 *
 * @returns True if IPC is running
 */
export const isLoaded = (): boolean => window.electron?.ipcRenderer !== undefined &&
		   window.api?.setTitle !== undefined &&
		   window.api?.refreshMenu !== undefined;


// > Main window handling
/**
 * Handle full screen view
 *
 * @param callback - Function to call on full screen status change
 */
export const handleFullscreen = (callback: (isFullscreen: boolean) => void): void => {

    window.electron.ipcRenderer.on("WINDOW:FULLSCREEN", (_event, isFullscreen: boolean) => callback(isFullscreen));
};

/**
 * Setup of a receiver for broadcast messages.
 *
 * @param callback - Function to be called on receiving a broadcast message
 */
export const receiveBroadcast = (callback: (eventType: string, params: (boolean | string)[]) => void): void => {

	window.electron.ipcRenderer.on("APP:BROADCAST",
								   (_event, {eventType, eventData}) =>
								   		callback(
											eventType as string,
											eventData as (boolean | string)[]
								   		)
	);
};

/**
 * Receive system menu selection.
 *
 * @param callback - Function to be called when an entry in the system menu is selected
 */
export const receiveMenuSelection = (callback: (menuEntry: string, payload: string) => void): void => {

	window.electron.ipcRenderer.on("APP:MENU", (_event, entryName: string, payload: string) =>
														callback(entryName, payload));
};

/**
 * Receive notifications from main process.
 *
 * @param callback - Function to be called when a notification arrives
 */
export const receiveNotifications = (callback: (type: "error" | "success",
												text: string) => void): void => {

	// Notifications from main process
	window.electron.ipcRenderer.on("APP:NOTIFICATION", (_event, type: string, text: string) =>
														callback(type as "error" | "success", text));

	// Notifications from main window
	watchEffect(() => {
		const messageStore = useMessageStore();

		const message = messageStore.system.error;
		if(message) {
			callback("error", message);
			messageStore.system.error = "";
		}
	});
};

/**
 * Refresh the system menu that has been changed in the main process
 */
export const receiveRefreshMenu = (): void => {

	window.electron.ipcRenderer.on("APP:REFRESH-MENU", window.api.refreshMenu);
};


// > Project
/**
 * Receive a loaded project
 *
 * @param callback - Function to call when receiving a new project
 */
export const receiveProject = (callback: (rawProject: string) => void): void => {

    window.electron.ipcRenderer.invoke("PROJECT:GET")
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

/**
 * Send the current node type to main process
 *
 * @param callback - Routine called when the main process require the current node type
 */
export const sendCurrentNode = (callback: () => string): void => {
	window.electron.ipcRenderer.on("PROJECT:ASK-CURRENT-NODE", () => {
		window.electron.ipcRenderer.send("PROJECT:GET-CURRENT-NODE", callback());
	});
};

/**
 * Set the title with the current loaded project path.
 *
 * @param baseTitle - The first part of the title
 */
export const setProjectPathInTitle = (baseTitle: string): void => {

	// Set the title the first time
	const project = window.electron.ipcRenderer
							.sendSync("PREFERENCES:GET-SYNC", "LastProjectLoaded") as string;

	if(project) {
		let idx = project.lastIndexOf("\\");
		if(idx < 0) idx = project.lastIndexOf("/");
    	window.api.setTitle(`${baseTitle} — ${project.slice(idx+1)}`);
	}
    else window.api.setTitle(`${baseTitle} — default project`);

	// Receive title updates
	window.electron.ipcRenderer.on("PROJECT:PATH", (_event, projectPath: string) => {

		window.api.setTitle(`${baseTitle} — ${projectPath || "default project"}`);
	});
};

// > Preferences
/**
 * Synchronously return a preference
 *
 * @param key - Key to retrieve
 * @param defaultValue - Default value for the preference if not in the store
 * @returns The preference value or the default
 */
export function getPreferenceSync<T>(key: string, defaultValue: T): T {

    const value = window.electron.ipcRenderer.sendSync("PREFERENCES:GET-SYNC", key) as T;
	return value ?? defaultValue;
}

/** Versions of the various application components */
export interface Versions {app: string; node: string; electron: string; chrome: string}
/**
 * Return system components versions.
 *
 * @returns The list of versions of iie, node, electron, chrome
 */
export const getVersions = (): Promise<Versions> => window.electron.ipcRenderer.invoke("APP:VERSIONS") as Promise<Versions>;

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
 * Close a secondary window.
 *
 * @param routerPath - Route path of the window to be closed
 */
export const closeWindow = (routerPath: string): void => {

	window.electron.ipcRenderer.send("WINDOW:CLOSE", routerPath);
};

/**
 * Receive a message sent by sendToWindow() routine.
 *
 * @param callback - Routine to be called when a message to this window is received
 * @remarks Should use a callback and not a Promise because should be always active
 */
export const receiveInWindow = (callback: (data: string) => void): void => {

    window.electron.ipcRenderer.on("APP:DATA", (_event, payload: string) => callback(payload));
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

// > Structure reader
/**
 * Structure read
 *
 * @param filename - Filename to be read
 * @param format - Format to be read
 * @param atomsTypes - Atoms types to use (if not present in the file)
 * @returns The structure read as JSON formatted string
 */
export const readFileStructure = (filename: string,
								  format: string, atomsTypes: string, useBohr: boolean): Promise<string> => window.electron.ipcRenderer.invoke("READER:READ",
											  filename, format, atomsTypes, useBohr) as Promise<string>;

/**
 * Auxiliary file read
 *
 * @param filename - Auxiliary file name
 * @param format - Format of the main file
 * @param structure - The structure read in the main file
 * @returns The augmented structure array encoded as JSON
 */
export const readAuxFile = (filename: string,
							format: string,
							structure: Structure): Promise<string> =>

	window.electron.ipcRenderer.invoke("READER:READ-AUX",
									  	filename, format, JSON.stringify(structure)
									  ) as Promise<string>;

/**
 * Get data needed for the atoms rename
 *
 * @param atomsZBefore - List of atoms Z before the rename
 * @param typesAfterString - New list of atoms types
 * @returns A RenameInfo object encoded as JSON
 */
export const atomsTypeRename = (atomsZBefore: string, typesAfterString: string): Promise<string> =>

	window.electron.ipcRenderer.invoke("READER:RENAME",
										atomsZBefore, typesAfterString
									  ) as Promise<string>;

// > Structure writer
/**
 * Select the file where the structure will be saved
 *
 * @param format - File format to be selected
 * @returns The selected filename path
 */
export const selectSaveStructureFile = (format: string): Promise<string> => window.electron.ipcRenderer.invoke("WRITER:SELECT", format) as Promise<string>;

/**
 * Save the structures to the file
 *
 * @param format - File format to be selected
 * @param filename - File path where to save the structures
 * @param encodedStructures - JSON encoded structures to be saved
 * @returns Response from the main process
 */
export const saveStructureFile = (format: string, filename: string, encodedStructures: string): Promise<MainResponse> => window.electron.ipcRenderer.invoke("WRITER:WRITE", format, filename, encodedStructures) as Promise<MainResponse>;

// > Capturer
/**
 * Save an image given as data url
 *
 * @param data - Data url representing an image
 * @returns Response from the main process
 */
export const saveDataURL = (data: string): Promise<MainResponse> => window.electron.ipcRenderer.invoke("VIEWER:SNAPSHOT", data) as Promise<MainResponse>;

/**
 * Save a movie
 *
 * @param buffer - Movie captured as buffer
 * @returns Response from the main process
 */
export const saveMovie = (buffer: ArrayBuffer): Promise<MainResponse> => window.electron.ipcRenderer.invoke("VIEWER:MOVIE", buffer) as Promise<MainResponse>;

// > Symmetries
/**
 * Compute symmetries in the main process
 *
 * @param spaceGroup - Space group of the structure
 * @param fractionalCoords - Fracional coordinates of the structure atoms
 * @returns The new fractional coordinates and error if any
 */
export const computeSymmetries = (spaceGroup: string, fractionalCoords: number[]): Promise<MainResponse> => window.electron.ipcRenderer.invoke("COMPUTE:SYMMETRIES", spaceGroup, fractionalCoords) as Promise<MainResponse>;

/**
 * Find structure symmetries in the main process
 *
 * @param params - Data for the computation
 * @returns The new structure with found symmetries and error if any
 */
export const findSymmetries = (params: FindSymmetriesParams): Promise<MainResponse> => window.electron.ipcRenderer.invoke("FIND:SYMMETRIES", JSON.stringify(params)) as Promise<MainResponse>;

export const findAndApplySymmetries = (params: ComputeSymmetriesParams): Promise<MainResponse> =>
	window.electron.ipcRenderer.invoke("SYMMETRIES:COMPUTE", JSON.stringify(params)) as Promise<MainResponse>;

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
