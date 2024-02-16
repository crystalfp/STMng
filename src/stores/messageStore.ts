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
	captureMedia: {
		typeS: "error" | "success" | "warning" | "info" | undefined;
		textS: string;
		typeM: "error" | "success" | "warning" | "info" | undefined;
		textM: string;
	};
	system: {
		error: string;
	};
}

export const useMessageStore = defineStore("MessageStore", {

    state: () => ({
        symmetries: {message: ""},
        structureReader: {message: ""},
		captureMedia: {
			typeS: undefined,
			textS: "",
			typeM: undefined,
			textM: "",
		},
		system: {error: ""}
	} as MessageState),
});

// > Support HMR during development
if(import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useMessageStore, import.meta.hot));
}
