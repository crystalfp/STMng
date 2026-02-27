/**
 * Prepare the channel and the store to save and read user preferences.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
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
 * along with STMng. If not, see <http://www.gnu.org/licenses/>.
 */
import {ipcMain, nativeTheme, type IpcMainEvent} from "electron";
import path from "node:path";
import {Store} from "./UserStore";

/** Create the store */
const store = new Store("preferences");

/**
 * Setup channel to read the preferences
 */
export const setupChannelPreferences = (): void => {

	ipcMain.on("PREFERENCES:GET-SYNC", (event: IpcMainEvent, key: string) => {

		event.returnValue = store.getString(key);
    });
};

// > Set main theme and save it to preferences
/**
 * Set main theme and save it to preferences
 *
 * @param theme - The new theme
 * @param force - If true, ignore theme in store and put the one from parameter
 */
export const setMainTheme = (theme: "dark" | "light", force = false): void => {

	if(force || !store.has("Theme")) {
		store.setString("Theme", theme);
	}
	else {
		theme = store.getString("Theme", "dark") as "dark" | "light";
	}
	nativeTheme.themeSource = theme;
};

/**
 * Return the last project loaded
 *
 * @returns Path to the last project loaded or empty string if no path stored
 */
export const getProjectPath = (): string => store.getString("LastProjectLoaded");

/**
 * Delete the last project loaded from preferences
 *
 * @returns Path to the last project loaded or empty string if no path stored
 */
export const removeProjectPath = (): void => {

	store.delete("LastProjectLoaded");
};

/**
 * Store in preferences the last loaded project file path
 *
 * @param filename - Project file path to store
 */
export const setProjectPath = (filename: string): void => {

	store.setString("LastProjectLoaded", path.resolve(filename));
};

/**
 * Return status of the viewer 3D
 *
 * @returns True if the viewer 3D is extended
 */
export const isExtended = (): boolean => {

	return store.getBoolean("ViewerExtended", false);
};

/**
 * Set viewer 3D extended status
 *
 * @param viewerIsExtended - Status of the Viewer 3D (true if extended)
 */
export const setExtended = (viewerIsExtended: boolean): void => {

	store.setBoolean("ViewerExtended", viewerIsExtended);
};

/**
 * Set maximize status
 *
 * @param isMaximized - True if the main window has been maximized
 */
export const setMaximized = (isMaximized: boolean): void => {

	store.setBoolean("MainWindowMaximized", isMaximized);
};

/**
 * Get main window maximize status
 *
 * @returns True if the window is maximized
 */
export const isMaximized = (): boolean =>  {

	return store.getBoolean("MainWindowMaximized", true);
};

/**
 * Save windows dimensions
 *
 * @param dims - Window dimensions as returned by getSize()
 */
export const setWindowSize = (dims: number[]): void => {

	store.setBoolean("MainWindowMaximized", false);
	store.setIntegers(["MainWindowWidth", "MainWindowHeight"], dims);
};

/**
 * Get the window dimensions
 *
 * @returns Window dimensions to be used by setSize()
 */
export const getWindowSize = (): number[] =>
	store.getIntegers(["MainWindowWidth", "MainWindowHeight"],
					  [1280, 720]);

/**
 * Set antialiasing
 *
 * @param setAA - If true enable antialiasing in the viewer3D
 */
export const setAntialiasing = (setAA: boolean): void => {

	store.setBoolean("Antialiasing", setAA);
};
