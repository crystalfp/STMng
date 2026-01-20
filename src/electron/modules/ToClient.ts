/**
 * Utilities to send something to the main window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2025-02-21
 */
import {ipcMain, type WebContents} from "electron";
import log from "electron-log";
import path from "node:path";
import type {CtrlParams, PositionType, StructureRenderInfo} from "@/types";
import type {ClientProjectInfo} from "@/types/NodeInfo";
import type {AlertLevel} from "@/stores/messageStore";

/** Saved access to client window */
let mainWinWebContents: WebContents | undefined;

/**
 * Setup connection to client window
 *
 * @param webContents - The mainWin.webContents
 */
export const toClientSetup = (webContents: WebContents): void => {
	mainWinWebContents = webContents;
};

/**
 * Ask the client to send a string.
 * For example the Viewer3D status stringified.
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @returns The string from client
 */
export const askClient = async (id: string, channel: string): Promise<string> => {

	const channelName = id + ":" + channel;
	return new Promise<string>((resolve) => {
		mainWinWebContents!.send(channelName);
		ipcMain.once(channelName + "-response",
					(_event: unknown, answer: string): void => {resolve(answer);});
	});
};

/**
 * Push data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param params - Parameters to send to the client process
 */
export const sendToClient = (id: string, channel: string, params: CtrlParams={}): void => {

	const channelName = id + ":" + channel;
	mainWinWebContents!.send(channelName, params);
};

/**
 * Push structure data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param vertices - Parameters to send to the client process
 */
export const sendVerticesToClient = (id: string, channel: string, vertices: number[]): void => {

    const channelName = id + ":" + channel;
    mainWinWebContents!.send(channelName, vertices);
};

/**
 * Push segments of a trace to client
 *
 * @param id - ID of the node sending the parameters
 * @param segments - List of segments (begin, end) coordinates
 * @param colors - Colors of each segment
 * @param skip - If corresponding segment should be skipped and not rendered
 */
export const sendSegmentsToClient = (id: string,
								     segments: PositionType[][],
								     colors: string[],
									 skip: boolean[]): void => {

	const channelName = id + ":segments";
	mainWinWebContents!.send(channelName, segments, colors, skip);
};

/**
 * Push isosurfaces data to client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param data - Data to draw isosurfaces
 */
export const sendIsosurfacesToClient = (id: string,
										channel: string,
										data: {
											indices: number[][];
											vertices: number[][];
											normals: number[][];
											isoValues: number[];
											params: CtrlParams;
										}): void => {

	const channelName = id + ":" + channel;
	mainWinWebContents!.send(channelName,
							 data.indices,
							 data.vertices,
							 data.normals,
							 data.isoValues,
							 data.params);
};

/**
 * Push structure data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param renderInfo - Parameters to send to the client process
 */
export const sendToClientForRendering = (id: string,
										 channel: string,
										 renderInfo: StructureRenderInfo): void => {

	const channelName = id + ":" + channel;
	mainWinWebContents!.send(channelName, renderInfo);
};

// > Open the given system menu entry
/**
 * Open the given system menu entry on the main window
 *
 * @param entryName - Label to identify the menu entry activated on the main window
 * @param payload - Optional data to be sent to the main window. If missing it is an empty string
 */
export const openMenuEntry = (entryName: string, payload=""): void => {

	mainWinWebContents!.send("SYSTEM:MENU", entryName, payload);
};


/**
 * Send the current project path to main window to put it in the title.
 *
 * @param projectPath - The project file path or an empty string for the default project
 */
export const sendProjectPath = (projectPath?: string): void => {

	mainWinWebContents!.send("PROJECT:PATH", projectPath ? path.basename(projectPath) : "");
};

/**
 * Request a system menu refresh in the client process
 */
export const refreshSystemMenu = (): void => {

	mainWinWebContents!.send("SYSTEM:REFRESH-MENU");
};

/**
 * Get the type of the current node
 *
 * @returns The type of the current node open in the UI
 */
export const getCurrentNode = async (): Promise<string> => {

	mainWinWebContents!.send("PROJECT:ASK-CURRENT-NODE");

	return new Promise<string>((resolve) => {
		ipcMain.on("PROJECT:GET-CURRENT-NODE",
				  (_event: unknown, answer: string): void => {resolve(answer);});
	});
};

/**
 * Update the main window project
 *
 * @param clientProjectInfo - Project info to be passes to the client to setup UI etc.
 */
export const sendProjectUI = (clientProjectInfo: ClientProjectInfo): void => {

	mainWinWebContents!.send("SYSTEM:project-send", clientProjectInfo);
};

/**
 * Send error notification from main process to main window
 *
 * @param message - Complete text of the notification
 * @param options - Optional parameters
	- userMessage: Simplified text of the notification for the user (default same as message)
	- level: Notification level (default "error")
	- node: From which node the alert originates
 */
export const sendAlertToClient = (message: string,
								  options: {
										userMessage?: string;
								   		level?: AlertLevel;
								   		node?: string;} = {}): void => {

	const {userMessage=message, level="error", node=""} = options;
	mainWinWebContents!.send("SYSTEM:notification", level, userMessage, node);
	switch(level) {
		case "error": log.error(message); break;
		case "warning": log.warn(message); break;
		case "success": log.info(message); break;
		case "info": log.info(message); break;
	}
};

/**
 * Push polyhedra data to the client
 *
 * @param id - ID of the node sending the parameters
 * @param channel - Specify the channel inside the id related group
 * @param vertices - List of vertices coordinates for each polyhedron
 * @param centerAtomsColor - List of center atoms colors
 */
export const sendPolyhedraToClient = (id: string,
									  channel: string,
									  vertices: number[][],
									  centerAtomsColor: string[]): void => {

	const channelName = id + ":" + channel;
	mainWinWebContents!.send(channelName, vertices, centerAtomsColor);
};

/**
* Push orthoslice and isolines data to client
*
* @param id - ID of the node sending the parameters
* @param channel - Specify the channel inside the id related group
* @param data - Data to draw orthoslice and isolines
*/
export const sendIsoOrthoToClient = (id: string,
									 channel: string,
									 data: {
										vertices: number[];
										indices: number[];
										values: number[];
										isolineVertices: number[][];
										isolineValues: number[];
										params: CtrlParams;
									 }): void => {

	const channelName = id + ":" + channel;
	mainWinWebContents!.send(channelName,
							 data.vertices,
							 data.indices,
							 data.values,
							 data.isolineVertices,
							 data.isolineValues,
							 data.params);
};
