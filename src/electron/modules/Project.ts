/**
 * Load and store the visualized project
 *
 * @packageDocumentation
 */

import {ipcMain, app} from "electron";
import log from "electron-log";
import fs from "fs-extra";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {sendLoadedProject, requestLoadedProject, sendToSecondaryWindow, createSecondaryWindow,
		isSecondaryWindowOpen, sendProjectPath, sendErrorNotification} from "./WindowsUtilities";
import {getProjectPath, setProjectPath, removeProjectPath} from "./Preferences";

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
		const message = `Cannot read project file "${filename}". Error: ${(error as Error).message}`;
		log.error(message);
		sendErrorNotification(message);

		sendLoadedProject("");
		projectAsString = "";
	}
};

/**
 * Create the project editor/viewer window
 */
export const createProjectEditor = (): void => {

	createSecondaryWindow(undefined, {
		routerPath: "/editor",
		width: 1700,
		height: 900,
		title: "View loaded project",
		data: projectAsString
	});
};

/**
 * Send the project content to the editor/viewer window
 */
export const sendProjectToEditor = (): void => {

	if(isSecondaryWindowOpen(undefined, "/editor")) {
		sendToSecondaryWindow(undefined, {routerPath: "/editor", data: projectAsString});
	}
};

/**
 * Get the default project file path
 *
 * @returns Full path to the default project
 */
const getDefaultProject = (): string => {

	const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
	const DIST = path.join(mainSourceDirectory, "..", "dist");
	const publicDir = app.isPackaged ? DIST : path.join(mainSourceDirectory, "..", "public");
	return path.join(publicDir, "default-project.stm");
};

/**
 * Read the given project, remember it and send it to client
 *
 * @param filename - Project file to be read
 * @returns True if the loaded project is the default one
 */
export const loadProjectAndRemember = (filename: string): boolean => {

	let loadedDefaultProject = false;

	if(fs.existsSync(filename)) {

		setProjectPath(filename);
		sendProjectPath(filename);
	}
	else {
		const message = `Project file "${filename}" does not exist. Loading default project`;
		log.error(message);
		sendErrorNotification(message);

		removeProjectPath();
		filename = getDefaultProject();
		sendProjectPath();
		loadedDefaultProject = true;
	}
	loadProject(filename);
	return loadedDefaultProject;
};

/**
 * Read the saved project or the default one
 *
 * @param ignoreSaved - If true read only the default project and remove the saved project path
 * @returns True if the loaded project is the default one
 */
export const loadRememberedProject = (ignoreSaved: boolean): boolean => {

	let filename;
	let loadedDefaultProject = false;
	if(ignoreSaved) {
		filename = getDefaultProject();
		removeProjectPath();
		sendProjectPath();
		loadedDefaultProject = true;
	}
	else {
		filename = getProjectPath();
		if(!filename) {
			filename = getDefaultProject();
			sendProjectPath();
			loadedDefaultProject = true;
		}
		if(fs.existsSync(filename)) sendProjectPath(filename);
		else {
			const message = `Project file "${filename}" does not exist. Loading default project`;
			log.error(message);
			sendErrorNotification(message);
			removeProjectPath();
			filename = getDefaultProject();
			sendProjectPath();
			loadedDefaultProject = true;
		}
	}
	loadProject(filename);
	return loadedDefaultProject;
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
			sendProjectPath(filename);
			setProjectPath(filename);
		})
		.catch((error: Error) => {
			const message = `Cannot save project file "${filename}". Error: ${error.message}`;
			log.error(message);
			sendErrorNotification(message);
			projectAsString = "";
		});
};

/**
 * Save a loaded project
 */
export const saveProject = (): void => {

	const filename = getProjectPath();
	if(filename) saveProjectAs(filename);
	else {
		const message = "Cannot save project. Filename not set";
		log.error(message);
		sendErrorNotification(message);
	}
};

/**
 * Setup the channel to handle project requests from client
 */
export const setupChannelProject = (): void => {
    ipcMain.handle("PROJECT:GET",  () => {
        return projectAsString;
    });
};
