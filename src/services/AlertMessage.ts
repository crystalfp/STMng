/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import log from "electron-log";
import {useMessageStore} from "@/stores/messageStore";

/**
 * Show error notification
 *
 * @param text - The error message
 * @param node - Node on which the message should be shown. If missing simply log the message
 */
export const showAlertMessage = (text: string, node?: string): void => {

	const messageStore = useMessageStore();
	messageStore.system.message = text;
	messageStore.system.level = "error";
	switch(node) {
		case "symmetries":
			messageStore.symmetries.message = text;
			break;
		case "structureReader":
			messageStore.structureReader.message = text;
			break;
		case "structureWriter":
			messageStore.structureWriter.message = text;
			break;
		case "fingerprints":
			messageStore.fingerprints.message = text;
			break;
	}
	log.error(text);
};

/**
 * Initialize the error message for a given node
 *
 * @param node - Node on which the message should be initialized.
 */
export const resetAlertMessage = (node: string): void => {

	const messageStore = useMessageStore();
	messageStore.system.message = "";
	switch(node) {
		case "symmetries":
			messageStore.symmetries.message = "";
			break;
		case "structureReader":
			messageStore.structureReader.message = "";
			break;
		case "structureWriter":
			messageStore.structureWriter.message = "";
			break;
		case "fingerprints":
			messageStore.fingerprints.message = "";
			break;
	}
};

/**
 * Check if there is a message for a given node
 *
 * @param node - Kind of node to check for messages
 * @returns True if a message for the given provider is presen
 */
export const hasAlertMessage = (node: string): boolean => {

	const messageStore = useMessageStore();
	switch(node) {
		case "symmetries":
			return messageStore.symmetries.message !== "";
		case "structureReader":
			return messageStore.structureReader.message !== "";
		case "structureWriter":
			return messageStore.structureWriter.message !== "";
		case "fingerprints":
			return messageStore.fingerprints.message !== "";
	}
	return false;
};

/**
 * Get the message text for a given node
 *
 * @param node - Kind of node to get messages
 * @returns The message
 */
export const getAlertMessage = (node: string): string => {
	const messageStore = useMessageStore();
	switch(node) {
		case "symmetries":
			return messageStore.symmetries.message;
		case "structureReader":
			return messageStore.structureReader.message;
		case "structureWriter":
			return messageStore.structureWriter.message;
		case "fingerprints":
			return messageStore.fingerprints.message;
	}
	return "?";
};

/** Level for the alert messages */
export type AlertLevel = "success" | "info" | "warning" | "error";

/**
 * Show a system alert message
 *
 * @param message - The message to display in a popup
 * @param level - Level of the alert
 */
export const showSystemAlert = (message: string, level: AlertLevel = "error"): void => {

	const messageStore = useMessageStore();
	messageStore.system.message = message;
	messageStore.system.level = level;

	if(level === "error") {
		log.error(message);
	}
	else if(level === "warning") {
		log.warn(message);
	}
	else {
		log.info(message);
	}
};
