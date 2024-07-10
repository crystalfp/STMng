/**
 * <<DESCRIPTION>>
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @file Dummy.ts
 * @since Sun Jul 07 2024
 */
export const errorNotification = (message: string): void => {
	console.log("errorNotification", message);
}

export const sendProjectPath = (projectPath?: string): void => {
	console.log("sendProjectPath", projectPath);
}
