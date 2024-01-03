/**
 * Load and store the visualized project
 *
 * @packageDocumentation
 */

import {ipcMain, app} from "electron";
import log from "electron-log";
import fs from "fs-extra";
import path from "node:path";
import {sendLoadedProject, requestLoadedProject} from "./WindowsUtilities";
import {getProjectPath, setProjectPath} from "./Preferences";
import {fileURLToPath} from "node:url";

let projectAsString = "";

/**
 * Read the given project and send it to client
 *
 * @param filename - Project file to be read
 */
export const loadProject = (filename?: string): void => {

	if(filename) setProjectPath(filename);
	else {
		filename = getProjectPath();
		if(!filename) {
			const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
			const DIST = path.join(mainSourceDirectory, "..", "dist");
			const publicDir = app.isPackaged ? DIST : path.join(mainSourceDirectory, "..", "public");
			filename = path.join(publicDir, "default-project.json");
		}
	}

	try {
		const rawProject = fs.readFileSync(filename, "utf8");
		if(!rawProject) throw Error("Empty project file");
		sendLoadedProject(rawProject);
		projectAsString = rawProject;
	}
	catch(error: unknown) {
		log.error(`Cannot read project file "${filename}". Error ${(error as Error).message}`);
		sendLoadedProject("");
		projectAsString = "";
	}
};

/**
 * Save the current project
 *
 * @param filename - Where the current project should be saved
 */
export const saveProject = (filename: string): void => {

	requestLoadedProject()
		.then((rawProject: string) => {
			fs.writeFileSync(filename, rawProject, "utf8");
			projectAsString = rawProject;
		})
		.catch((error: Error) => {
			log.error(`Cannot save project file "${filename}". Error ${error.message}`);
			projectAsString = "";
		});
};

export const setupChannelProject = (): void => {
    ipcMain.handle("PROJECT:GET1",  () => {
        return projectAsString;
    });
};
