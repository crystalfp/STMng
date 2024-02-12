import log from "electron-log";
import {useMessageStore} from "@/stores/messageStore";

export const showErrorNotification = (text: string, node?: string): void => {

	const messageStore = useMessageStore();
	messageStore.system.error = text;
	switch(node) {
		case "findSymmetries":
			messageStore.findSymmetries.message = text;
			break;
		case "applySymmetries":
			messageStore.applySymmetries.message = text;
			break;
		case "structureReader":
			messageStore.structureReader.message = text;
			break;
	}
	log.error(text);
};

export const resetErrorNotification = (node?: string): void => {

	const messageStore = useMessageStore();
	messageStore.system.error = "";
	switch(node) {
		case "findSymmetries":
			messageStore.findSymmetries.message = "";
			break;
		case "applySymmetries":
			messageStore.applySymmetries.message = "";
			break;
		case "structureReader":
			messageStore.structureReader.message = "";
			break;
	}
};
