/**
 * Setup and update project editor window.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-08-09
 */

import {pm} from "./ProjectManager";
import {createSecondaryWindow, isSecondaryWindowOpen, sendToSecondaryWindow} from "./WindowsUtilities";

/**
 * Create the project editor/viewer window
 */
export const createProjectEditor = (): void => {

	createSecondaryWindow(undefined, {
		routerPath: "/editor",
		width: 1700,
		height: 900,
		title: "View loaded project",
		data: pm.projectGraphForEditor()
	});
};

/**
 * Send the project content to the editor/viewer window
 */
export const sendProjectToEditor = (): void => {

	if(isSecondaryWindowOpen(undefined, "/editor")) {
		const projectAsString = pm.projectGraphForEditor();
		sendToSecondaryWindow(undefined, {routerPath: "/editor", data: projectAsString});
	}
};
