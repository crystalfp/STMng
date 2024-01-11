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
import {getProjectPath, setProjectPath, removeProjectPath} from "./Preferences";
import {fileURLToPath} from "node:url";

let projectAsString = "";

/**
 * Read the given project and send it to client
 *
 * @param filename - Project file to be read
 */
const loadProject = (filename: string): void => {

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

const getDefaultProject = (): string => {

	const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
	const DIST = path.join(mainSourceDirectory, "..", "dist");
	const publicDir = app.isPackaged ? DIST : path.join(mainSourceDirectory, "..", "public");
	return path.join(publicDir, "default-project.json");
};


/**
 * Read the given project, remember it and send it to client
 *
 * @param filename - Project file to be read
 */
export const loadProjectAndRemember = (filename: string): void => {

	setProjectPath(filename);

	loadProject(filename);
};

/**
 * Read the saved project or the default one
 *
 * @param ignoreSaved - If true read only the default project and remove the saved project path
 */
export const loadRememberedProject = (ignoreSaved: boolean): void => {

	let filename;
	if(ignoreSaved) {
		filename = getDefaultProject();
		removeProjectPath();
	}
	else {
		filename = getProjectPath();
		if(!filename) filename = getDefaultProject();
	}
	loadProject(filename);
};

/**
 * Save the current project
 *
 * @param filename - Where the current project should be saved
 */
export const saveProjectAs = (filename: string): void => {

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

export const saveProject = (): void => {

	const filename = getProjectPath();
	if(filename) saveProjectAs(filename);
	else log.error("Cannot save project. Filename not set.");
};

export const setupChannelProject = (): void => {
    ipcMain.handle("PROJECT:GET1",  () => {
        return projectAsString;
    });
};
