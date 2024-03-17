/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 */
import log from "electron-log";
import {useMessageStore} from "@/stores/messageStore";

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
	}
	log.error(text);
};

export const resetErrorNotification = (node?: string): void => {

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
	}
};
