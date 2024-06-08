/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 */
import log from "electron-log";
import {useMessageStore} from "@/stores/messageStore";

/**
 * Show error notification
 *
 * @param text - The error message
 * @param node - Node on which the message should be shown. If missing simply log the message
 */
export const showErrorNotification = (text: string, node?: string): void => {

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
export const resetErrorNotification = (node: string): void => {

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
