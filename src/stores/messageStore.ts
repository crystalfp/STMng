/**
 * Messages that flow from computations to the UI.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle at ikmail.com"
 * @since 2024-07-05
 */
import {defineStore, acceptHMRUpdate} from "pinia";

/** Level for the alert messages */
export type AlertLevel = "success" | "info" | "warning" | "error";

/**
 * Kind of message from capture media
 * @notExported
 */
type MessageType = AlertLevel | undefined;

/**
 * Content of the store
 * @notExported
 */
interface MessageState {
	/** Messages for the symmetry node */
	symmetries: string;
	/** Messages for the structure reader node */
    structureReader: string;
	/** Messages for the structure writer node */
    structureWriter: string;
	/** Messages for the fingerprints node */
	fingerprints: string;
	/** Messages for the slice structure node */
	slicer: string;
	/** Messages for the capture media node */
	captureMedia: {
		/** Take snapshot message type */
		typeS: MessageType;
		/** Take snapshot message text */
		textS: string;
		/** Create movie message type */
		typeM: MessageType;
		/** Create movie message text */
		textM: string;
		/** Export STL file message type */
		typeT: MessageType;
		/** Export STL file message text */
		textT: string;
	};
	/** System messages */
	system: {
		/** Message text */
		message: string;
		/** Kind of message */
		level: AlertLevel;
	};
}

/** Access the message store that contains messages that flow from computations to the UI */
export const useMessageStore = defineStore("MessageStore", {

    state: () => ({
        symmetries: "",
        structureReader: "",
        structureWriter: "",
		fingerprints: "",
		captureMedia: {
			typeS: undefined,
			textS: "",
			typeM: undefined,
			textM: "",
			typeT: undefined,
			textT: "",
		},
		system: {message: "", level: "error"},
	} as MessageState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMessageStore, import.meta.hot));
}
