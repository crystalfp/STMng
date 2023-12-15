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
// import type {WindowsParams} from "@/electron/types";

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
