/**
 * Load and store the visualized project
 *
 * @packageDocumentation
 */

// import {ipcMain} from "electron";
import log from "electron-log";
import fs from "fs-extra";
import path from "node:path";
import {sendLoadedProject, requestLoadedProject} from "./WindowsUtilities";
import {getProjectPath, setProjectPath} from "./Preferences";
import {fileURLToPath} from "node:url";

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
			filename = path.join(mainSourceDirectory, "../dist/default-project.json");
		}
	}

	try {
		const rawProject = fs.readFileSync(filename, "utf8");
		if(!rawProject) throw Error("Empty project file");
		sendLoadedProject(rawProject);
	}
	catch(error: unknown) {
		log.error(`Cannot read project file "${filename}". Error ${(error as Error).message}`);
		sendLoadedProject("");
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
		})
		.catch((error: Error) => {
			log.error(`Cannot save project file "${filename}". Error ${error.message}`);
		});
};
