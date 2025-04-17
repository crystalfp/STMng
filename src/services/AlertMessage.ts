/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import log from "electron-log";
import {useMessageStore, type AlertLevel} from "@/stores/messageStore";

/**
 * Show error notification
 *
 * @param text - The error message
 * @param node - Node on which the message should be shown. If missing simply log the message
 */
export const showAlertMessage = (text: string, node: string): void => {

	const messageStore = useMessageStore();
	messageStore.system.message = text;
	messageStore.system.level = "error";
	switch(node) {
		case "symmetries":
			messageStore.symmetries = text;
			break;
		case "structureReader":
			messageStore.structureReader = text;
			break;
		case "structureWriter":
			messageStore.structureWriter = text;
			break;
		case "fingerprints":
			messageStore.fingerprints = text;
			break;
		case "slicer":
			messageStore.slicer = text;
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
			messageStore.symmetries = "";
			break;
		case "structureReader":
			messageStore.structureReader = "";
			break;
		case "structureWriter":
			messageStore.structureWriter = "";
			break;
		case "fingerprints":
			messageStore.fingerprints = "";
			break;
		case "slicer":
			messageStore.slicer = "";
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
			return messageStore.symmetries !== "";
		case "structureReader":
			return messageStore.structureReader !== "";
		case "structureWriter":
			return messageStore.structureWriter !== "";
		case "fingerprints":
			return messageStore.fingerprints !== "";
		case "slicer":
			return messageStore.slicer !== "";
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
			return messageStore.symmetries;
		case "structureReader":
			return messageStore.structureReader;
		case "structureWriter":
			return messageStore.structureWriter;
		case "fingerprints":
			return messageStore.fingerprints;
		case "slicer":
			return messageStore.slicer;
	}
	return "?";
};

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
