/**
 * Access the application log file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-24
 */
import {app, ipcMain} from "electron";
import path from "node:path";
import {readFileSync, copyFileSync, writeFileSync} from "node:fs";
import {createSecondaryWindow, sendAlertMessage} from "./WindowsUtilities";

/**
 * Open a secondary window to show the current log file
 */
export const showLogFile = (): void => {

	const directory = app.getPath("userData");
	const logPath = path.join(directory, "logs", "main.log");
	try {
		const log = readFileSync(logPath, "utf8");
		createSecondaryWindow({
			routerPath: "/log",
			width: 1400,
			height: 900,
			title: "Application log file",
			data: log
		});
	}
	catch(error: unknown) {
		sendAlertMessage(`Error getting log file: ${(error as Error).message}`);
	}
};

/**
 * Setup channel to clean the logfile
 */
export const setupChannelLogFile = (): void => {

    ipcMain.on("LOGFILE:CLEAR", () => {

		const directory = app.getPath("userData");
		const currentPath = path.join(directory, "logs", "main.log");
		const savePath = path.join(directory, "logs", "main.old.log");

		copyFileSync(currentPath, savePath);
		writeFileSync(currentPath, "", "utf8");
	});
};
