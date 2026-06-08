/**
 * Manage atomic data alternative to the default loaded ones.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2026-05-02
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
 * along with STMng. If not, see https://gnu.org/licenses/ .
 */
import {app, ipcMain} from "electron";
import {existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {getAtomDataDefault, setAtomDataDefault} from "./Preferences";
import {publicDirPath} from "./GetPublicPath";
import {getDataTable, loadDataTable, type AtomInfo} from "./AtomData";

/**
 * Get path to the user atom data file
 *
 * @param filename - User data file name
 * @returns Full path to the user atom data file
 */
const getDataFilePath = (filename: string): string => {

	const directory = app.getPath("userData");
	const userDataDir = path.join(directory, "UserData");
	if(!existsSync(userDataDir)) {
		mkdirSync(userDataDir, {recursive: true});
	}
	return path.join(userDataDir, filename);
};

/**
 * Select the atom data set to use
 *
 * @param useDefault - True if the default atom data should be used
 */
export const selectAtomDataFile = (useDefault: boolean): void => {

	// Save the preference
	setAtomDataDefault(useDefault);

	// Get the path
	let filePath;
	if(useDefault) {

		filePath = publicDirPath("default-atom-data.json");
	}
	else {

		filePath = getDataFilePath("atom-data.json");
		if(!existsSync(filePath)) {

			const sourcePath = publicDirPath("default-atom-data.json");
			copyFileSync(sourcePath, filePath);
		}
	}

	// Read and load the file
	const content = readFileSync(filePath, "utf8");
	const data = JSON.parse(content) as AtomInfo[];
	loadDataTable(data);
};

/**
 * Setup channel to read and write the atom data
 */
export const setupChannelAtomData = (): void => {

	// Load the initial atom data set
	selectAtomDataFile(getAtomDataDefault());

	ipcMain.handle("ATOM-DATA:GET", () => {

		return {
			useDefault: getAtomDataDefault(),
			data: JSON.stringify(getDataTable())
		};
	});

	ipcMain.on("ATOM-DATA:SET", (_event, params: {useDefault: boolean; data: string}) => {

		setAtomDataDefault(params.useDefault);
		loadDataTable(JSON.parse(params.data) as AtomInfo[]);
		writeFileSync(getDataFilePath("atom-data.json"), params.data, "utf8");
	});
};
