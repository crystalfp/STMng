/**
 * Get the full path to a file under the "public" directory
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-09-19
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
import path from "node:path";
import {fileURLToPath} from "node:url";
import {app} from "electron";

/**
 * Add the correct path to the public directory for development and production
 * @remarks The files should be copied into `resources/` directory in an
 * extraFiles section in electron-builder.yaml file
 *
 * @param filename - Filename inside the public directory
 * @param unpacked - True if the packaged file is under the `resources/` directory
 * @returns The complete path to the given file
 */
export const publicDirPath = (filename: string, unpacked=false): string => {

	const modulePath = (globalThis as unknown as {modulePath: string}).modulePath;

	if(!app.isPackaged) {
		const mainSourceDirectory = path.dirname(fileURLToPath(modulePath));
		return path.join(mainSourceDirectory, "..", "public", filename);
	}
	if(unpacked) {
		return path.join(process.resourcesPath, filename);
	}
	return path.join(path.resolve(process.resourcesPath, "app.asar/dist"), filename);
};
