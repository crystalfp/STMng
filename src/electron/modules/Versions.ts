/**
 * Setup the channel to visualize application, Chrome, node and electron versions
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {ipcMain} from "electron";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {existsSync, readFileSync} from "node:fs";

/**
 * Setup the channel to visualize the application version and
 * extract version from "package.json" file
 */
export const setupChannelVersions = (): void => {

	ipcMain.handle("SYSTEM:VERSIONS", () => {

		let appVersion = "0.0.0";
		const projectDir = path.dirname(fileURLToPath(import.meta.url));

		const pkgFile = path.join(projectDir, "..", "package.json");
		if(existsSync(pkgFile)) {

			const packageContent = JSON.parse(readFileSync(pkgFile, "utf8")) as {version: string};
			appVersion = packageContent.version;
		}
		const {node, electron, chrome} = process.versions;
		return {node, electron, chrome, app: appVersion};
	});
};
