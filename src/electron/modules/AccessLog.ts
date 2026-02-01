/**
 * Access the application log file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-24
 */
import {app, ipcMain} from "electron";
import path from "node:path";
import {readFileSync, copyFileSync, writeFileSync, existsSync} from "node:fs";
import {createOrUpdateSecondaryWindow} from "./WindowsUtilities";
import {sendAlertToClient} from "./ToClient";

/**
 * Open a secondary window to show the current log file
 */
export const showLogFile = (): void => {

	const directory = app.getPath("userData");
	const logPath = path.join(directory, "logs", "main.log");
	try {
		const logContent = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
		createOrUpdateSecondaryWindow({
			routerPath: "/log",
			width: 1400,
			height: 900,
			title: "Application log file",
			data: {content: logContent}
		});
	}
	catch(error: unknown) {
		sendAlertToClient(`Error getting log file: ${(error as Error).message}`);
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
