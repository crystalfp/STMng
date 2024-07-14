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
import {errorNotification} from "../electron/modules/MockFunctions";

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
export const receiveProjectUI = (callback: (clientProjectInfo: ClientProjectInfo) => void) => {

    window.electron.ipcRenderer.invoke("PROJECT:SEND:INFO-FIRST")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo))
		.catch((error: Error) => errorNotification(`Cannot retrieve project first time. ${error.message}`));

    window.electron.ipcRenderer.on("PROJECT:SEND:INFO-NEXT",
					(_event, clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo));
}

// > Communication
/**
* Receive the parameters from the main process node
*
* @param id - ID of the node receiving the parameters
* @param channel - Specify the channel inside the id related group
* @param onReceive - Function to be called when the parameters from the node change
*/
export const getFromNode = (id: string, channel: string, onReceive: (params: CtrlParams) => void): void => {

	// TBD
	void id
	void channel;
	onReceive({});
};
