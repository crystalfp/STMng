/**
 * Setup and update project editor window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-08-09
 */

import {pm} from "./ProjectManager";
import {createSecondaryWindow, isSecondaryWindowOpen,
		sendToSecondaryWindow} from "./WindowsUtilities";

/**
 * Create the project editor/viewer window
 *
 * @param projectName - Name of the loaded project or empty string if default project is loaded
 */
export const createProjectEditor = (projectName: string): void => {

	const title = projectName === "" ? "View default project" : `View "${projectName}" project`;

	createSecondaryWindow({
		routerPath: "/project-editor",
		width: 1800,
		height: 800,
		title,
		data: pm.projectGraphForEditor()
	});
};

/**
 * Send the project content to the editor/viewer window
 */
export const sendProjectToEditor = (): void => {

	if(isSecondaryWindowOpen("/project-editor")) {
		sendToSecondaryWindow("/project-editor", pm.projectGraphForEditor());
	}
};
