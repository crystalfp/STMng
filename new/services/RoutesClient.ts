/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-10
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {ClientProjectInfo, CtrlParams} from "../types";
import {sendAlertMessage} from "../../src/electron/modules/WindowsUtilities";

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
 * Receive the project information to build the controls/ui
 *
 * @param callback - Routines called to receive the project information to build the controls/ui
 */
export const receiveProjectUI = (callback: (clientProjectInfo: ClientProjectInfo) => void) => {

    window.electron.ipcRenderer.invoke("PROJECT:SEND:INFO-FIRST")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo))
		.catch((error: Error) => sendAlertMessage(`Cannot retrieve project first time. ${error.message}`));

    window.electron.ipcRenderer.on("PROJECT:SEND:INFO-NEXT",
					(_event, clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo));
}

// > Communication
/**
* Ask to receive the parameters from the main process node
*
* @param id - ID of the node receiving the parameters
* @param channel - Specify the channel inside the id related group
* @param params - Parameters to send to the main process node
* @returns Parameters from the main process node
*/
export const askNode = (id: string, channel: string, params?: CtrlParams): Promise<CtrlParams> => {

	return params?
		window.electron.ipcRenderer.invoke(`${id}${channel}`, params) as Promise<CtrlParams> :
		window.electron.ipcRenderer.invoke(`${id}${channel}`) as Promise<CtrlParams>;
};
