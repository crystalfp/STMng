/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
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
	messageStore.system.error = text;
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
	messageStore.system.error = "";
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
}

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
}
