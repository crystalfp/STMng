/**
 * Prepare the channel and the store to save and read user preferences.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ipcMain, nativeTheme, type IpcMainEvent} from "electron";
import path from "node:path";
import {Store} from "./UserStore";

/**
 * The accepted preference types
 * @notExported
 */
type PreferenceEntry = string | number;

/**
 * The type of the store
 * @notExported
 */
type PreferencesStore = Record<string, PreferenceEntry>;

/** Create the store */
const store = new Store<PreferencesStore>({name: "preferences"});

/**
 * Setup channel to read/write preferences
 */
export const setupChannelPreferences = (): void => {

	ipcMain.handle("PREFERENCES:GET", (_event, key: string) => store.get(key));

	ipcMain.on("PREFERENCES:GET-SYNC", (event: IpcMainEvent, key: string) => {

		event.returnValue = store.get(key);
    });

    ipcMain.on("PREFERENCES:SET", (_event, payload: {key: string; value: PreferenceEntry}) => {

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
export const getProjectPath = (): string => store.get("LastProjectLoaded", "") as string;

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

	store.set("LastProjectLoaded", path.resolve(filename));
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

	store.set("MainWindowMaximized", "no");
	store.set("MainWindowWidth", dims[0]);
	store.set("MainWindowHeight", dims[1]);
};

/**
 * Get the window dimensions
 *
 * @returns Window dimensions to be used by setSize()
 */
export const getWindowSize = (): number[] => [
	store.get("MainWindowWidth", 1280) as number,
	store.get("MainWindowHeight", 720) as number
];

/**
 * Set antialiasing
 *
 * @param set - If true enable antialiasing in the viewer3D
 */
export const setAntialiasing = (set: boolean): void => {

	store.set("Antialiasing", set ? "yes" : "no");
};
