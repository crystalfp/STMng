/**
 * Access the application log file
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-24
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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
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
