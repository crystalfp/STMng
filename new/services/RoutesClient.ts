/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file RoutesClient.ts
 * @since Fri Jul 10 2024
 */
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {ClientProjectInfo} from "../types";
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
export const receiveProjectUI = (callback: (clientProjectInfo: Record<string, ClientProjectInfo>) => void) => {

    window.electron.ipcRenderer.invoke("PROJECT:SEND:INFO-FIRST")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((clientProjectInfo: Record<string, ClientProjectInfo>) => callback(clientProjectInfo))
		.catch((error: Error) => errorNotification(`Cannot retrieve project first time. ${error.message}`));

    window.electron.ipcRenderer.on("PROJECT:SEND:INFO-NEXT",
					(_event, clientProjectInfo: Record<string, ClientProjectInfo>) => callback(clientProjectInfo));
}
