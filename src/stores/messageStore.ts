/**
 * Messages that flow from computations to the UI.
 *
 * @packageDocumentation
 */
import {defineStore, acceptHMRUpdate} from "pinia";

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
		typeS: "error" | "success" | "warning" | "info" | undefined;
		textS: string;
		typeM: "error" | "success" | "warning" | "info" | undefined;
		textM: string;
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
		},
		system: {error: ""},
		fingerprints: {message: ""},
	} as MessageState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMessageStore, import.meta.hot));
}
