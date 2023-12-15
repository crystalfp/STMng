
// import {ipcMain} from "electron";
import log from "electron-log";
import fs from "fs-extra";
import path from "node:path";
import {sendLoadedProject} from "./WindowsUtilities";
import {getProjectPath, setProjectPath} from "./Preferences";
import {fileURLToPath} from "node:url";

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
export const saveProject = (filename: string): void => {
	console.log("SAVE", filename); // TBD
};
export const setupProject = (): void => {

	// ipcMain.handle("PROJECT:GET", (_event, filePath: string) => {

	// 	lastFilename = filePath === "" ? defaultFilePath : filePath;
	// 	loadProject(lastFilename);
	// });
	// ipcMain.on("PROJECT:SAVE", (_event, filePath: string, rawProject: string) => {
	// 	if(!lastFilename) {}
	// });
};
