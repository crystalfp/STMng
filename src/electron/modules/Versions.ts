/**
 * Setup the channel to visualize application, Chrome, node
 * and electron versions
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {ipcMain} from "electron";

/**
 * Setup the channel to visualize the application components versions
 *
 * @param appVersion - Application version from package.json loaded in main.ts
 */
export const setupChannelVersions = (appVersion: string): void => {

	ipcMain.handle("SYSTEM:VERSIONS", () => {

		const {node, electron, chrome} = process.versions;
		return {node, electron, chrome, app: appVersion};
	});
};
