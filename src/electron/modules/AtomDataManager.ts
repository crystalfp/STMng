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
 * along with STMng. If not, see http://www.gnu.org/licenses/ .
 */

import {app, ipcMain} from "electron";
import {existsSync, mkdirSync, copyFileSync, readFileSync} from "node:fs";
import path from "node:path";
import {getAtomDataDefault, setAtomDataDefault} from "./Preferences";
import {publicDirPath} from "./GetPublicPath";
import {getData, loadData, type AtomInfo} from "./AtomData";

/**
 * Check if default data set is in use
 *
 * @returns True if the default atom data set is in use
 */
export const isUsingDefaultAtomData = (): boolean => {

	return getAtomDataDefault();
};

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
 * Load atom data
 *
 * @param filePath - Path to the atom data file to load and use
 */
const loadAtomData = (filePath: string): void => {

	const content = readFileSync(filePath, "utf8");
	const data = JSON.parse(content) as AtomInfo[];
	loadData(data);
};

/**
 * Select the atom data set to use
 *
 * @param useDefault - True if the default atom data should be used
 */
export const selectAtomDataFile = (useDefault: boolean): void => {

	setAtomDataDefault(useDefault);

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
	loadAtomData(filePath);
};

/**
 * Setup channel to read the preferences
 */
export const setupChannelAtomData = (): void => {

	selectAtomDataFile(getAtomDataDefault());

	ipcMain.handle("ATOM-DATA:GET", () => {

		return {
			useDefault: getAtomDataDefault(),
			data: JSON.stringify(getData())
		};
	});

	ipcMain.on("ATOM-DATA:SET", (_event, params: {useDefault: boolean; data: string}) => {

		setAtomDataDefault(params.useDefault);
	});
};
