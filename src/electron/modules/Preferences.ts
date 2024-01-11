/**
 * Prepare channel and store to save and read user preferences
 *
 * @packageDocumentation
 */
import {ipcMain, nativeTheme} from "electron";
import {Store} from "./UserStore";
import type {IpcMainInvokeEvent, IpcMainEvent} from "electron";

/** The accepted preference types */
type PreferenceEntry = string | number | string[];
/** The type of the store */
type PreferencesStore = Record<string, PreferenceEntry>;

/** Create the store */
const store = new Store<PreferencesStore>({name: "preferences"});

/**
 * Setup channel to read/write preferences
 */
export const setupChannelPreferences = (): void => {

	ipcMain.handle("PREFERENCES:GET", (_event: IpcMainInvokeEvent, key: string) => {

        return store.get(key);
    });

	ipcMain.on("PREFERENCES:GET-SYNC", (event: IpcMainEvent, key: string) => {

		event.returnValue = store.get(key);
    });

    ipcMain.on("PREFERENCES:SET", (_event: IpcMainInvokeEvent, payload: {key: string; value: PreferenceEntry}) => {

		const {key, value} = payload;
		store.set(key, value);
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
		store.set("Theme", theme);
	}
	else {
		theme = store.get("Theme", "dark") as "dark" | "light";
	}
	nativeTheme.themeSource = theme;
};

/**
 * Return the last project loaded
 *
 * @returns Path to the last project loaded or empty string if no path stored
 */
export const getProjectPath = (): string => {

	return store.get("LastProjectLoaded", "") as string;
};

/**
 * Delete the last project loaded
 *
 * @returns Path to the last project loaded or empty string if no path stored
 */
export const removeProjectPath = (): void => {

	store.delete("LastProjectLoaded");
};

/**
 * Store the last loaded project file path
 *
 * @param filename - Project file path to store
 */
export const setProjectPath = (filename: string): void => {

	store.set("LastProjectLoaded", filename);
};
