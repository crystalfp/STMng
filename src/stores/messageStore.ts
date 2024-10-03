/**
 * Messages that flow from computations to the UI.
 *
 * @packageDocumentation
 *
 * @author Mario Valle "mvalle\@ikmail.com"
 * @since 2024-07-05
 */
import {defineStore, acceptHMRUpdate} from "pinia";

/**
 * Kind of message from capture media
 * @notExported
 */
type MessageType = "error" | "success" | "warning" | "info" | undefined;

interface MessageState {
    symmetries: {
		message: string;
	};
    structureReader: {
		message: string;
	};
    structureWriter: {
		message: string;
	};
	captureMedia: {
		typeS: MessageType;
		textS: string;
		typeM: MessageType;
		textM: string;
		typeT: MessageType;
		textT: string;
	};
	system: {
		error: string;
	};
	fingerprints: {
		message: string;
	};
}

export const useMessageStore = defineStore("MessageStore", {

    state: () => ({
        symmetries: {message: ""},
        structureReader: {message: ""},
        structureWriter: {message: ""},
		captureMedia: {
			typeS: undefined,
			textS: "",
			typeM: undefined,
			textM: "",
			typeT: undefined,
			textT: "",
		},
		system: {error: ""},
		fingerprints: {message: ""},
	} as MessageState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMessageStore, import.meta.hot));
}
