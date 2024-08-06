/**
 * Relay of messages between a secondary window and the main window
 *
 * @remarks It is still the original from IIE. Adapt it.
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 */
import type {BrowserWindow} from "electron";
// import {ipcMain, type BrowserWindow} from "electron";
// import {broadcastMessage} from "../../../new/electron/WindowsUtilities";

/**
 * Setup the relay between secondary windows and main window.
 *
 * @param win - The main window to which the messages should be relayed
 */
export const setupRelayToMainWin = (win: BrowserWindow): void => {
	// ipcMain.on("COLORS:SEND", (_event, payload: {qualitative: string; sequential: string; contrasting: string}) => {
	// 	win.webContents.postMessage("COLORS:RESEND", payload);
	// });
	// ipcMain.on("PROJECTS:SEND", (_event, payload: string) => {
	// 	win.webContents.postMessage("PROJECTS:RESEND", payload);
	// });
	// ipcMain.on("TOC:SEND", (_event, payload: number) => {
	// 	win.webContents.postMessage("TOC:RESEND", payload);
	// });
	// ipcMain.on("DOC:SEND", (_event, payload: string) => {
	// 	win.webContents.postMessage("DOC:RESEND", payload);
	// });
	void win;
};

// interface BroadcastMessage {
// 	eventType: string;
// 	data: (boolean | string)[];
// }

/**
 * Setup the relay of broadcast message from the main window to all windows
 */
export const setupRelayFromMainWin = (): void => {

	// ipcMain.on("APP:BROADCAST-RELAY", (_event, payload: BroadcastMessage) => {

	// 	const {eventType, data} = payload;
	// 	broadcastMessage(eventType, ...data);
	// });
};
