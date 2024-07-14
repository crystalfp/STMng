/**
 * Dummy functions needed during the transition.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-07
 */
export const errorNotification = (message: string): void => {
	console.log("errorNotification", message);
}

export const sendProjectPath = (projectPath?: string): void => {
	console.log("sendProjectPath", projectPath);
}
