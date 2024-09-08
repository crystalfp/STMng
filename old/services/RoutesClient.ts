/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {WindowsParams} from "../../new/types";
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
