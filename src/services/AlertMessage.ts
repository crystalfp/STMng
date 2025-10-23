/**
 * Prepare error notification for the snackbar component and error log.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import log from "electron-log";
import {useMessageStore, type AlertLevel} from "@/stores/messageStore";

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

/**
 * Display an alert for the given node
 *
 * @param message - Alert message text
 * @param node - Node originating the alert
 * @param options - Optional parameters
		- level: Kind of alert (default "error")
		- alsoSystem: If also a system alert should be shown
 */
export const showNodeAlert = (message: string,
							  node: string,
							  options: {
									level?: AlertLevel;
									alsoSystem?: boolean;
							  } = {}): void => {

	const {level="error", alsoSystem=false} = options;

	const messageStore = useMessageStore();

	messageStore.node = node;
	messageStore.level = level;
	messageStore.text = message;

	if(alsoSystem) {
		messageStore.system.message = message;
		messageStore.system.level = level;
	}

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

/**
 * Reset error messages
 */
export const resetNodeAlert = (): void => {

	const messageStore = useMessageStore();

	messageStore.node = "";
	messageStore.level = "error";
	messageStore.text = "";
};
