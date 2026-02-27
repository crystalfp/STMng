/**
 * Setup the channel to visualize application, Chrome, node
 * and electron versions
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
