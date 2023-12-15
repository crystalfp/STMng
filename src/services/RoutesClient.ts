/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
import log from "electron-log";
// import type {IpcRendererEvent} from "electron";
// import type {ProjectOnScreen, TagValue, MainResponse, DocumentFull, DocumentMetadata,
// 			 DocumentReferenceWithTitle, UUID, FragmentContext, QueryResultsBlock, Languages} from "@/types";
import type {WindowsParams} from "@/electron/types";

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
export const isLoaded = (): boolean => {

	return window.electron?.ipcRenderer !== undefined &&
		   window.api?.setTitle !== undefined;
};


// > Main window handling
/**
 * Set main window title
 *
 * @param title - The title to set on the main window
 */
export const setTitle = (title: string): void => window.api.setTitle(title);

/**
 * Receive a loaded project
 *
 * @param callback - Function to call when receiving a new project
 */
export const receiveProject = (callback: (rawProject: string) => void): void => {

    window.electron.ipcRenderer.invoke("PROJECT:GET1")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((rawProject: string) => callback(rawProject))
		.catch((error: Error) => log.error("Cannot retrieve project first time", error.message));
    window.electron.ipcRenderer.on("PROJECT:GET2", (_event, rawProject: string) => callback(rawProject));
};

export const sendProject = (callback: () => string): void => {
	window.electron.ipcRenderer.on("PROJECT:REQUEST", () => {
		console.log("REQUEST", callback());
		window.electron.ipcRenderer.send("PROJECT:ANSWER", callback());
	});
};

/**
 * Handle full screen selection
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
export const getVersions = (): Promise<Versions> => {

	return window.electron.ipcRenderer.invoke("APP:VERSIONS") as Promise<Versions>;
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
