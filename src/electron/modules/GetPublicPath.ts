/**
 * Get the full path to a file under the "public" directory
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-19
 */
import path from "node:path";
import {fileURLToPath} from "node:url";
import {app} from "electron";

/**
 * Add the correct path to the public directory for development and production
 * @remark The files should be copied into `resources/` directory in a extraFiles section in
 * electron-builder.yaml file
 *
 * @param filename - Filename inside the public directory
 * @param unpacked - True if the packaged file is under the `resources/` directory
 * @returns The complete path to the given file
 */
export const publicDirPath = (filename: string, unpacked=false): string => {

	if(!app.isPackaged) {
		const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		return path.join(mainSourceDirectory, "..", "public", filename);
	}
	else if(unpacked) {
		return path.join(process.resourcesPath, filename);
	}
	return path.join(path.resolve(process.resourcesPath, "app.asar/dist"), filename);
};
