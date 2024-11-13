/**
 * Get the full path to a file under the "public" directory
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-09-19
 */
import path from "node:path";
import {fileURLToPath} from "node:url";
import {app} from "electron";

/**
 * Add the correct path to the public directory for development and production
 *
 * @param filename - Filename inside the public directory
 * @returns The complete path to the given file
 */
export const publicDirPath = (filename: string): string => {

	const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
	const publicDir = path.join(mainSourceDirectory, "..", app.isPackaged ? "dist" : "public");
	return path.join(publicDir, filename);
};

/**
 * Add the correct path to the public directory for development and production
 *
 * @param filename - Filename inside the public directory
 * @returns The complete path to the given file
 */
export const publicImagePath = (filename: string): string => {

	if(app.isPackaged) {
		const mainSourceDirectory = path.dirname(fileURLToPath(import.meta.url));
		const publicDir = path.join(mainSourceDirectory, "..", "dist");
		return path.join(publicDir, filename);
	}
	return `/${filename}`;
};
