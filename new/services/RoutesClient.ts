/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-10
 */
import {watchEffect} from "vue";
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {ClientProjectInfo, CtrlParams, StructureRenderInfo} from "../types";
import {showAlertMessage} from "./AlertMessage";
import {useMessageStore} from "@/stores/messageStore";

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
 * Verify if IPC is up and running.
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
 * Receive the project information to build the controls/ui
 *
 * @param callback - Routines called to receive the project information to build the controls/ui
 */
export const receiveProjectUI = (callback: (clientProjectInfo: ClientProjectInfo) => void): void => {

    window.electron.ipcRenderer.invoke("PROJECT:SEND:INFO-FIRST")
		// eslint-disable-next-line promise/no-callback-in-promise
		.then((clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo))
		.catch((error: Error) => showAlertMessage(`Cannot retrieve project first time. ${error.message}`));

    window.electron.ipcRenderer.on("PROJECT:SEND:INFO-NEXT",
					(_event, clientProjectInfo: ClientProjectInfo) => callback(clientProjectInfo));
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

/** Versions of the various application components */
export interface Versions {app: string; node: string; electron: string; chrome: string}
/**
 * Return system components versions.
 *
 * @returns The list of versions of iie, node, electron, chrome
 */
export const getVersions = (): Promise<Versions> => window.electron.ipcRenderer.invoke("APP:VERSIONS") as Promise<Versions>;

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

// > Communication
/**
 * Ask to receive the parameters from the main process node
 *
 * @param id - ID of the node receiving the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the main process node
 * @returns Parameters from the main process node
 */
export const askNode = (id: string, channel: string, params?: CtrlParams): Promise<CtrlParams> =>
	(params?
		window.electron.ipcRenderer.invoke(`${id}:${channel}`, params) as Promise<CtrlParams> :
		window.electron.ipcRenderer.invoke(`${id}:${channel}`) as Promise<CtrlParams>);

/**
 * Send parameters to the main process node
 *
 * @param id - ID of the node receiving the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the main process node
 */
export const sendToNode = (id: string, channel: string, params: CtrlParams): void => {

	window.electron.ipcRenderer.send(`${id}:${channel}`, params);
};

/**
 * Receive parameters as push message
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Callback function called when a message is received
 */
export const receiveFromNode = (id: string, channel: string, callback: (params: CtrlParams) => void): void => {

    window.electron.ipcRenderer.on(`${id}:${channel}`, (_event, params: CtrlParams) => callback(params));
};

/**
 * Receive parameters as push message
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Callback function called when a message is received
 */
export const receiveFromNodeForRendering = (id: string,
											channel: string,
											callback: (renderInfo: StructureRenderInfo) => void): void => {

    window.electron.ipcRenderer.on(`${id}:${channel}`,
								   (_event, renderInfo: StructureRenderInfo) => callback(renderInfo));
};

/**
 * Send the viewer3D state to the main process
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param getState - Function that returns the viewer3D status stringified
 */
export const sendViewer3DState = (id: string,
								  channel: string,
								  getState: () => string): void => {

    window.electron.ipcRenderer.on(`${id}:${channel}`, () => {

		window.electron.ipcRenderer.send(`${id}:${channel}-res`, getState());
	});
};

/**
 * Receive parameters as push message
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Callback function called when a message is received
 */
export const receiveVerticesFromNode = (id: string,
										channel: string,
										callback: (vertices: number[]) => void): void => {

    window.electron.ipcRenderer.on(`${id}:${channel}`,
								   (_event, vertices: number[]) => callback(vertices));
};
