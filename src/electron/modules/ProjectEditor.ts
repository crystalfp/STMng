/**
 * Setup and update project editor window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-09
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
import {pm} from "./ProjectManager";
import {createOrUpdateSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "./WindowsUtilities";

/**
 * Create the project editor/viewer window
 *
 * @param projectName - Name of the loaded project or empty string if default project is loaded
 */
export const createProjectEditor = (projectName: string): void => {

	const title = projectName === "" ? "View default project" : `View "${projectName}" project`;

	createOrUpdateSecondaryWindow({
		routerPath: "/project-editor",
		width: 1800,
		height: 800,
		title,
		data: {project: pm.projectGraphForEditor()}
	});
};

/**
 * Send the project content to the editor/viewer window
 */
export const sendProjectToEditor = (): void => {

	if(isSecondaryWindowOpen("/project-editor")) {
		sendToSecondaryWindow("/project-editor", {project: pm.projectGraphForEditor()});
	}
};
