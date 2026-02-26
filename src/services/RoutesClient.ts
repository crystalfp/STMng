/**
 * Interfaces to the channels to the main process.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-10
 *
 * Copyright 2026 Mario Valle
 *
 * This file is part of STMng.
 *
 * STMng is free software: you can redistribute it and/or modify
 * it under the terms of the version 3 of the GNU General Public License
 * as published by the Free Software Foundation.
 *
 * STMng is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
 /* eslint-disable unicorn/prefer-global-this */
import {watchEffect} from "vue";
import {useMessageStore, type AlertLevel} from "@/stores/messageStore";
import type {ElectronAPI} from "@electron-toolkit/preload";
import type {CtrlParams, PositionType, StructureRenderInfo} from "@/types";
import type {ClientProjectInfo} from "@/types/NodeInfo";
import {setBaseTitle, setProjectInTitle} from "@/services/SetTitle";

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

    window.electron.ipcRenderer.on("WINDOW:FULLSCREEN", (_event, isFullscreen: boolean) => {callback(isFullscreen);});
};

/**
 * Setup of a receiver for broadcast messages.
 *
 * @param callback - Function to be called on receiving a broadcast message
 */
export const receiveBroadcast = (callback: (eventType: string, params: (boolean | string)[]) => void): void => {

	window.electron.ipcRenderer.on("SYSTEM:BROADCAST",
								   (_event, {eventType, eventData}) => {
								   		callback(
											eventType as string,
											eventData as (boolean | string)[]
								   		);
									}
	);
};

/**
 * Receive system menu selection.
 *
 * @param callback - Function to be called when an entry in the system menu is selected
 */
export const receiveMenuSelection = (callback: (menuEntry: string, payload: string) => void): void => {

	window.electron.ipcRenderer.on("SYSTEM:MENU",
								   (_event, entryName: string, payload: string) => {
										callback(entryName, payload);
									});
};

/**
 * Receive notifications from main process.
 *
 * @param callback - Function to be called when a notification arrives
 */
export const receiveNotifications = (callback: (type: AlertLevel,
												text: string,
												from: string) => void): void => {

	// Notifications from main process
	window.electron.ipcRenderer.on("SYSTEM:notification",
							(_event, type: string, text: string, from: string) => {
								callback(type as AlertLevel, text, from);
							});

	// Notifications from main window
	watchEffect(() => {
		const messageStore = useMessageStore();

		const message = messageStore.system.message;
		if(message) {
			callback(messageStore.system.level, message, "");
			messageStore.system.message = "";
		}
	});
};

/**
 * Refresh the system menu that has been changed in the main process
 */
export const receiveRefreshMenu = (): void => {

	window.electron.ipcRenderer.on("SYSTEM:REFRESH-MENU", window.api.refreshMenu);
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
 * Handle exit application confirmation
 *
 * @param callback - Function to call on exit confirmation request
 */
export const handleExitConfirmation = (callback: () => void): void => {

    window.electron.ipcRenderer.on("WINDOW:CONFIRM-EXIT", () => {callback();});
};

// > Project
/**
 * Receive the project information to build the controls/ui
 *
 * @param callback - Routines called to receive the project information to build the controls/ui
 */
export const receiveProjectUI = (callback: (clientProjectInfo: ClientProjectInfo) => void): void => {

    window.electron.ipcRenderer.on("SYSTEM:project-send",
					(_event, clientProjectInfo: ClientProjectInfo) => {
						callback(clientProjectInfo);
					});
};

/**
 * Set the title with the current loaded project path.
 *
 * @param baseTitle - The first part of the title
 */
export const setProjectPathInTitle = (baseTitle: string): void => {

	setBaseTitle(baseTitle);

	// Set the title the first time
	const project = window.electron.ipcRenderer
							.sendSync("PREFERENCES:GET-SYNC", "LastProjectLoaded") as string;

	if(project) {
		let idx = project.lastIndexOf("\\");
		if(idx < 0) idx = project.lastIndexOf("/");
		setProjectInTitle(project.slice(idx+1));
	}
    else {
		setProjectInTitle("default project");
	}

	// Receive title updates
	window.electron.ipcRenderer.on("PROJECT:PATH", (_event, projectPath: string) => {

		setProjectInTitle(projectPath);
	});
};

/**
 * Set the title string
 *
 * @param title - The title to be set
 */
export const setTitle = (title: string): void => window.api.setTitle(title);

// > Preferences

/** Versions of the various application components */
export interface Versions {
	/** The application version */
	app: string;
	/** The Node version */
	node: string;
	/** The Electron version */
	electron: string;
	/** The Chrome version */
	chrome: string;
}

/**
 * Return system components versions.
 *
 * @returns The list of versions of iie, node, electron, chrome
 */
export const getVersions = async (): Promise<Versions> => window.electron.ipcRenderer.invoke("SYSTEM:VERSIONS") as Promise<Versions>;

/**
 * Synchronously return a preference
 *
 * @param key - Key to retrieve
 * @param defaultValue - Default value for the preference if not in the store
 * @returns The preference value or the default
 */
export const getPreferenceSync = (key: string, defaultValue: string): string => {

    const value = window.electron.ipcRenderer.sendSync("PREFERENCES:GET-SYNC", key) as string;
	return value || defaultValue;
};

// > Communication from main process
/**
 * Ask to receive the parameters from the main process node
 *
 * @param id - ID of the node receiving the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the main process node
 * @returns Parameters from the main process node
 */
export const askNode = async (id: string,
							  channel: string,
							  params?: CtrlParams): Promise<CtrlParams> => {

	const channelName = id + ":" + channel;
	return params?
		window.electron.ipcRenderer.invoke(channelName, params) as Promise<CtrlParams> :
		window.electron.ipcRenderer.invoke(channelName) as Promise<CtrlParams>;
};

/**
 * Send parameters to the main process node
 *
 * @param id - ID of the node receiving the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the main process node
 */
export const sendToNode = (id: string, channel: string, params: CtrlParams={}): void => {

	const channelName = id + ":" + channel;
	window.electron.ipcRenderer.send(channelName, params);
};

/**
 * Receive parameters as push message
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Callback function called when a message is received
 */
export const receiveFromNode = (id: string, channel: string, callback: (params: CtrlParams) => void): void => {

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName, (_event, params: CtrlParams) => {
		callback(params);
	});
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

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName,
								   (_event, renderInfo: StructureRenderInfo) => {
										callback(renderInfo);
									});
};

/**
 * Receive polyhedra data for rendering as push message
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Callback function called when a message is received
 */
export const receivePolyhedraFromNode = (id: string,
										 channel: string,
										 callback: (vertices: number[][],
										 			centerAtomsColor: string[]) => void): void => {

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName,
				(_event, vertices: number[][], centerAtomsColor: string[]) => {
					callback(vertices, centerAtomsColor);
				});
};

/**
 * Receive parameters to draw the orthoslice and isolines
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Function called with the parameters to draw the orthoslice and isolines
 */
export const receiveIsoOrthoFromNode = (id: string,
										channel: string,
										callback: (
											vertices: number[],
											indices: number[],
											values: number[],
											isolineVertices: number[][],
											isolineValues: number[],
											params: CtrlParams) => void
										): void => {

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName,
				(_event,
				 vertices: number[],
				 indices: number[],
				 values: number[],
				 isolineVertices: number[][],
				 isolineValues: number[],
				 params: CtrlParams) => {
					callback(vertices, indices,
							 values, isolineVertices,
							 isolineValues, params);
				});
};

/**
 * Receive parameters to draw isosurfaces
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param callback - Function called with the parameters to draw the orthoslice and isolines
 */
export const receiveIsosurfacesFromNode = (id: string,
										   channel: string,
										   callback: (
												indices: number[][],
												vertices: number[][],
												normals: number[][],
												isoValues: number[],
												params: CtrlParams) => void
										  ): void => {

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName,
				(_event,
				 indices: number[][],
				 vertices: number[][],
				 normals: number[][],
				 isoValues: number[],
				 params: CtrlParams) => {
					callback(indices, vertices, normals, isoValues, params);
				});
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

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName, () => {

		window.electron.ipcRenderer.send(channelName + "-response", getState());
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

	const channelName = id + ":" + channel;
    window.electron.ipcRenderer.on(channelName,
								   (_event, vertices: number[]) => {callback(vertices);});
};

/**
 * Receive last segment coordinates of a traces and colors as push message
 *
 * @param id - ID of the node sending the parameters
 * @param callback - Callback function called when a message is received
 */
export const receiveSegmentsFromNode = (id: string,
									    callback: (segments: PositionType[][],
								    			   colors: string[],
												   skip: boolean[]) => void): void => {

	const channelName = id + ":segments";
    window.electron.ipcRenderer.on(channelName,
								   (_event,
								    segments: PositionType[][],
								    colors: string[],
								    skip: boolean[]) => {callback(segments, colors, skip);});
};

/**
 * Get status of antialiasing
 *
 * @returns If antialiasing is enabled
 */
export const getAntialiasing = (): boolean => {
	const antialiasing = window.electron.ipcRenderer
							.sendSync("PREFERENCES:GET-SYNC", "Antialiasing") as string;
	return antialiasing === "yes";
};

/**
 * Secondary window ask the main process node to receive the initial data
 * and the subsequent updates
 *
 * @param routerPath - Route path of the requester window
 * @param callback - Routine to be called when data is received.
 * 					 On error the key "error" is added to the callback argument
 */
export const requestData = (routerPath: string,
						    callback: (data: CtrlParams) => void): void => {

	const channel = routerPath.replace("/", "");

	const channelName = `SYSTEM:DATA:${channel}`;
	window.electron.ipcRenderer.on(channelName, (_event, payload: CtrlParams) => {
		callback(payload);
	});

	const initialChannelName = `SYSTEM:INITIAL-DATA:${channel}`;
	window.electron.ipcRenderer.invoke(initialChannelName)
		.then((params: CtrlParams) => {
			setTimeout(() => callback(params), 0);
		})
		.catch((error: Error) => {
			setTimeout(() => callback({error: error.message}), 0);
		});
};

// > Communication to windows
/**
 * Close a secondary window.
 *
 * @param routerPath - Route path of the window to be closed
 */
export const closeWindow = (routerPath: string): void => {

	window.electron.ipcRenderer.send("WINDOW:CLOSE", routerPath);
};

// > Log file
/**
 * Ask to clear the application log file
 */
export const clearLog = (): void => {window.electron.ipcRenderer.send("LOGFILE:CLEAR");};

 /* eslint-enable unicorn/prefer-global-this */
